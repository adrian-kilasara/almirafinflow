import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  TrendingUp, TrendingDown, ArrowLeft, Activity, History,
  Search, Download, BarChart3, AlertTriangle, Shield, ChevronRight,
  ArrowUpRight, ArrowDownRight, Zap, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import type { Account, Transaction, Budget, SavingsGoal, AccountAuditLog } from '@/types/finance';

interface AccountDetailPanelProps {
  account: Account;
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  onBack: () => void;
}

const tabItems = [
  { id: 'transactions', label: 'Transactions', icon: Zap },
  { id: 'linked', label: 'Linked', icon: ChevronRight },
  { id: 'audit', label: 'Audit Log', icon: History },
] as const;

export default function AccountDetailPanel({
  account, transactions, budgets, savingsGoals, onBack,
}: AccountDetailPanelProps) {
  const [search, setSearch] = useState('');
  const [auditLogs, setAuditLogs] = useState<AccountAuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>('transactions');
  const PAGE_SIZE = 20;

  const acctTxns = useMemo(
    () => transactions.filter(t => t.account_id === account.id).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, account.id]
  );

  const filteredTxns = useMemo(() => {
    if (!search) return acctTxns;
    const q = search.toLowerCase();
    return acctTxns.filter(t =>
      (t.description || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      t.type.includes(q)
    );
  }, [acctTxns, search]);

  const paginatedTxns = filteredTxns.slice(0, page * PAGE_SIZE);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('account_audit_log' as any)
        .select('*')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setAuditLogs(data as any as AccountAuditLog[]);
    })();
  }, [account.id]);

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];

  const last30 = acctTxns.filter(t => t.date >= d30);
  const last7 = acctTxns.filter(t => t.date >= d7);

  const calcStats = (txns: Transaction[]) => {
    const inflow = txns.filter(t => t.type === 'income' || (t.type === 'transfer' && t.description?.includes('from'))).reduce((s, t) => s + Number(t.amount), 0);
    const outflow = txns.filter(t => t.type === 'expense' || (t.type === 'transfer' && t.description?.includes('to'))).reduce((s, t) => s + Number(t.amount), 0);
    return { inflow, outflow, net: inflow - outflow };
  };

  const stats30 = calcStats(last30);
  const stats7 = calcStats(last7);

  const linkedBudgets = budgets.filter(b => {
    const budgetTxns = acctTxns.filter(t => t.category_id === b.category_id);
    return budgetTxns.length > 0;
  });

  const balanceTrend = useMemo(() => {
    const months: { name: string; balance: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const monthTxns = acctTxns.filter(t => t.date <= monthEnd);
      const income = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      months.push({
        name: d.toLocaleDateString('en', { month: 'short' }),
        balance: Number(account.opening_balance || 0) + income - expense,
      });
    }
    return months;
  }, [acctTxns, account.opening_balance]);

  const avgBalance = balanceTrend.length > 0
    ? balanceTrend.reduce((s, m) => s + m.balance, 0) / balanceTrend.length
    : Number(account.balance);

  const volatility = balanceTrend.length > 1
    ? Math.sqrt(balanceTrend.reduce((s, m) => s + Math.pow(m.balance - avgBalance, 2), 0) / balanceTrend.length)
    : 0;

  const isDormant = last30.length === 0;
  const isLiability = (account as any).classification === 'liability';

  const handleExport = () => {
    const headers = ['Date', 'Type', 'Amount', 'Currency', 'Description', 'Notes'];
    const rows = acctTxns.map(t => [t.date, t.type, t.amount, t.currency, t.description || '', t.notes || '']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${account.name}-transactions.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: '7-Day Flow', value: stats7.net, icon: stats7.net >= 0 ? ArrowUpRight : ArrowDownRight, color: stats7.net >= 0 ? 'text-income' : 'text-expense' },
    { label: '30-Day Flow', value: stats30.net, icon: stats30.net >= 0 ? ArrowUpRight : ArrowDownRight, color: stats30.net >= 0 ? 'text-income' : 'text-expense' },
    { label: 'Avg Balance', value: avgBalance, icon: BarChart3, color: 'text-primary' },
  ];

  const statusInfo = isDormant
    ? { label: 'Dormant', icon: AlertTriangle, color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10' }
    : volatility > avgBalance * 0.5
    ? { label: 'Volatile', icon: Activity, color: 'text-expense', bg: 'bg-expense/10' }
    : { label: 'Stable', icon: Shield, color: 'text-income', bg: 'bg-income/10' };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Hero Header */}
      <Card className="relative overflow-hidden border-primary/10">
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{ background: `radial-gradient(circle at 70% 30%, ${account.color || 'hsl(var(--primary))'}, transparent 60%)` }}
        />
        <CardContent className="relative p-5">
          <div className="flex items-start gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center hover:bg-muted transition-colors mt-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl border border-border/30"
                  style={{ backgroundColor: (account.color || '#14b8a6') + '15' }}
                >
                  {account.icon || '💳'}
                </motion.div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">{account.name}</h2>
                  <p className="text-xs text-muted-foreground capitalize flex items-center gap-1.5">
                    {isLiability ? '📉 Liability' : '📈 Asset'} · {account.type.replace('_', ' ')}
                    {account.institution_name && <><span className="text-border">·</span> {account.institution_name}</>}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <motion.p
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-2xl font-bold font-mono tracking-tight ${isLiability ? 'text-expense' : ''}`}
              >
                {isLiability ? '-' : ''}{formatCurrency(Math.abs(Number(account.balance)), account.currency)}
              </motion.p>
              <div className="flex items-center justify-end gap-2 mt-1">
                <Badge variant={isLiability ? 'destructive' : 'default'} className="text-[10px] h-5">
                  {isLiability ? 'Liability' : 'Asset'}
                </Badge>
                <Badge variant="outline" className={`text-[10px] h-5 ${statusInfo.color}`}>
                  <statusInfo.icon className="w-2.5 h-2.5 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <Card className="hover:border-primary/20 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <stat.icon className={`w-3 h-3 ${stat.color}`} />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
                <p className={`text-sm font-mono font-bold ${stat.color}`}>
                  {stat.label !== 'Avg Balance' && stat.value >= 0 ? '+' : ''}{formatCurrency(stat.value, account.currency)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className={`${statusInfo.bg} border-transparent`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Activity</p>
              </div>
              <p className="text-sm font-semibold">{last30.length} txns <span className="text-muted-foreground font-normal text-xs">/ 30d</span></p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Balance Trend Chart */}
      {balanceTrend.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-3 h-3 text-primary" />
                </div>
                Balance Trend
                <span className="text-[10px] text-muted-foreground font-normal ml-auto">6 months</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={balanceTrend}>
                  <defs>
                    <linearGradient id="detailBalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v, account.currency)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', color: 'hsl(var(--card-foreground))' }}
                  />
                  <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#detailBalGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Custom Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/30 mb-4">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="detailTabBg"
                    className="absolute inset-0 bg-card border border-border/50 rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3 h-3" />
                  {tab.label}
                  {tab.id === 'transactions' && <span className="text-[10px] text-muted-foreground">({acctTxns.length})</span>}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* Transactions */}
          {activeTab === 'transactions' && (
            <motion.div
              key="transactions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/30 border-border/30"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>

              {paginatedTxns.length > 0 ? (
                <div className="space-y-1.5">
                  {paginatedTxns.map((t, i) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-border/30 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          t.type === 'income' ? 'bg-income/10' : t.type === 'expense' ? 'bg-expense/10' : 'bg-primary/10'
                        }`}>
                          {t.type === 'income' ? <ArrowUpRight className="w-3.5 h-3.5 text-income" /> :
                           t.type === 'expense' ? <ArrowDownRight className="w-3.5 h-3.5 text-expense" /> :
                           <Activity className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.description || t.type}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(t.date)}</p>
                        </div>
                      </div>
                      <p className={`font-mono text-sm font-semibold shrink-0 ${
                        t.type === 'income' ? 'text-income' : t.type === 'expense' ? 'text-expense' : 'text-primary'
                      }`}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(Number(t.amount), t.currency)}
                      </p>
                    </motion.div>
                  ))}
                  {filteredTxns.length > paginatedTxns.length && (
                    <Button variant="ghost" className="w-full text-xs" onClick={() => setPage(p => p + 1)}>
                      Load more ({filteredTxns.length - paginatedTxns.length} remaining)
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No transactions found</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Linked */}
          {activeTab === 'linked' && (
            <motion.div
              key="linked"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Linked Budgets</h4>
                {linkedBudgets.length > 0 ? linkedBudgets.map((b, i) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors flex justify-between mb-1.5"
                  >
                    <span className="text-sm font-medium">{b.name}</span>
                    <span className="text-sm font-mono text-muted-foreground">{formatCurrency(Number(b.amount), b.currency)}</span>
                  </motion.div>
                )) : <p className="text-sm text-muted-foreground py-4 text-center">No linked budgets</p>}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Savings Goals</h4>
                {savingsGoals.length > 0 ? savingsGoals.map((g, i) => {
                  const pct = Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100);
                  return (
                    <motion.div
                      key={g.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors mb-1.5"
                    >
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-medium">{g.icon || '🎯'} {g.name}</span>
                        <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                        <span>{formatCurrency(Number(g.current_amount), g.currency)}</span>
                        <span>{formatCurrency(Number(g.target_amount), g.currency)}</span>
                      </div>
                    </motion.div>
                  );
                }) : <p className="text-sm text-muted-foreground py-4 text-center">No savings goals</p>}
              </div>
            </motion.div>
          )}

          {/* Audit */}
          {activeTab === 'audit' && (
            <motion.div
              key="audit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-1.5"
            >
              {auditLogs.length > 0 ? auditLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors flex items-start justify-between"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">{log.action.replace('_', ' ')}</p>
                    {log.field_changed && (
                      <p className="text-[11px] text-muted-foreground">
                        {log.field_changed}: <span className="text-expense">{log.old_value}</span> → <span className="text-income">{log.new_value}</span>
                      </p>
                    )}
                    {log.notes && <p className="text-[11px] text-muted-foreground">{log.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {log.amount != null && (
                      <p className={`text-xs font-mono ${Number(log.amount) >= 0 ? 'text-income' : 'text-expense'}`}>
                        {Number(log.amount) >= 0 ? '+' : ''}{formatCurrency(Number(log.amount), account.currency)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-12">
                  <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No audit entries yet</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
