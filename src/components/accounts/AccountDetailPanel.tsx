import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  TrendingUp, TrendingDown, ArrowLeft, Activity, History,
  Search, Download, BarChart3, AlertTriangle, Shield, ChevronRight, Scale,
  ArrowUpRight, ArrowDownRight, Zap, Clock, Wallet, Calendar,
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
  { id: 'reconcile', label: 'Reconcile', icon: Scale },
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
    const inflow = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const outflow = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
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
  const isLiability = account.classification === 'liability';

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

  const statusInfo = isDormant
    ? { label: 'Dormant', icon: AlertTriangle, color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10' }
    : volatility > avgBalance * 0.5
    ? { label: 'Volatile', icon: Activity, color: 'text-expense', bg: 'bg-expense/10' }
    : { label: 'Stable', icon: Shield, color: 'text-income', bg: 'bg-income/10' };

  const accentColor = account.color || 'hsl(var(--primary))';

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Hero Header */}
      <Card className="relative overflow-hidden border-primary/10">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ background: `radial-gradient(ellipse 80% 50% at 70% 30%, ${accentColor}, transparent 60%)` }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-32 opacity-[0.03]"
          style={{ background: `radial-gradient(circle at 30% 100%, hsl(var(--income)), transparent 60%)` }}
        />
        <CardContent className="relative p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <motion.button
              whileHover={{ scale: 1.1, x: -2 }}
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center hover:bg-muted transition-colors mt-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}08)`,
                    border: `1px solid ${accentColor}30`,
                    boxShadow: `0 8px 24px ${accentColor}15`,
                  }}
                >
                  {account.icon || '💳'}
                </motion.div>
                <div className="min-w-0">
                  <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-xl sm:text-2xl font-extrabold truncate"
                  >
                    {account.name}
                  </motion.h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={isLiability ? 'destructive' : 'default'} className="text-[10px] h-5 rounded-md">
                      {isLiability ? '↓ Liability' : '↑ Asset'}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground capitalize">
                      {account.type.replace('_', ' ')}
                      {account.institution_name && ` · ${account.institution_name}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <motion.p
                initial={{ scale: 0.85, opacity: 0, y: -8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${isLiability ? 'text-expense' : ''}`}
              >
                {isLiability ? '-' : ''}{formatCurrency(Math.abs(Number(account.balance)), account.currency)}
              </motion.p>
              <div className="flex items-center justify-end gap-2 mt-1.5">
                <Badge variant="outline" className={`text-[10px] h-5 rounded-md ${statusInfo.color}`}>
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
        {[
          { label: '7-Day Flow', value: stats7.net, icon: stats7.net >= 0 ? ArrowUpRight : ArrowDownRight, color: stats7.net >= 0 ? 'text-income' : 'text-expense', showSign: true },
          { label: '30-Day Flow', value: stats30.net, icon: stats30.net >= 0 ? ArrowUpRight : ArrowDownRight, color: stats30.net >= 0 ? 'text-income' : 'text-expense', showSign: true },
          { label: 'Avg Balance', value: avgBalance, icon: BarChart3, color: 'text-primary', showSign: false },
          { label: 'Activity', value: last30.length, icon: Clock, color: 'text-muted-foreground', isCount: true },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="hover:border-primary/20 transition-all duration-300 hover:shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.1)]">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-lg bg-muted/50 flex items-center justify-center">
                    <stat.icon className={`w-3 h-3 ${stat.color}`} />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                </div>
                {(stat as any).isCount ? (
                  <p className="text-sm font-bold">{stat.value} <span className="text-muted-foreground font-normal text-xs">txns</span></p>
                ) : (
                  <p className={`text-sm font-mono font-bold ${stat.color}`}>
                    {stat.showSign && stat.value >= 0 ? '+' : ''}{formatCurrency(stat.value, account.currency)}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Balance Trend Chart */}
      {balanceTrend.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-3 h-3 text-primary" />
                </div>
                Balance Trend
                <span className="text-[10px] text-muted-foreground font-normal ml-auto">6 months</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={balanceTrend}>
                  <defs>
                    <linearGradient id="detailBalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v, account.currency)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'hsl(var(--card-foreground))',
                      boxShadow: '0 8px 32px -8px hsl(0 0% 0% / 0.3)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#detailBalGrad)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/40 border border-border/30 mb-4">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium rounded-xl transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="detailTabBg2026"
                    className="absolute inset-0 bg-card border border-border/50 rounded-xl shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}>
                  <Icon className="w-3 h-3" />
                  {tab.label}
                  {tab.id === 'transactions' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {acctTxns.length}
                    </span>
                  )}
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/20 border-border/30 rounded-xl"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 rounded-xl">
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>

              {paginatedTxns.length > 0 ? (
                <div className="space-y-1.5">
                  {paginatedTxns.map((t, i) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ x: 4, transition: { duration: 0.2 } }}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/15 hover:bg-muted/30 border border-transparent hover:border-border/30 transition-all duration-300 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                          t.type === 'income' ? 'bg-income/10' : t.type === 'expense' ? 'bg-expense/10' : 'bg-primary/10'
                        }`}>
                          {t.type === 'income' ? <ArrowUpRight className="w-4 h-4 text-income" /> :
                           t.type === 'expense' ? <ArrowDownRight className="w-4 h-4 text-expense" /> :
                           <Activity className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{t.description || t.type}</p>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-2.5 h-2.5 text-muted-foreground/50" />
                            <p className="text-[10px] text-muted-foreground">{formatDate(t.date)}</p>
                          </div>
                        </div>
                      </div>
                      <p className={`font-mono text-sm font-bold shrink-0 ${
                        t.type === 'income' ? 'text-income' : t.type === 'expense' ? 'text-expense' : 'text-primary'
                      }`}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(Number(t.amount), t.currency)}
                      </p>
                    </motion.div>
                  ))}
                  {filteredTxns.length > paginatedTxns.length && (
                    <Button variant="ghost" className="w-full text-xs rounded-xl" onClick={() => setPage(p => p + 1)}>
                      Load more ({filteredTxns.length - paginatedTxns.length} remaining)
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-14">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-muted/30 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No transactions found</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">Try adjusting your search</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Reconcile */}
          {activeTab === 'reconcile' && (
            <motion.div
              key="reconcile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <ReconciliationPanel
                account={account}
                transactions={transactions}
                onBack={() => setActiveTab('transactions')}
                onRefresh={() => {}}
              />
            </motion.div>
          )}

          {/* Linked */}
          {activeTab === 'linked' && (
            <motion.div
              key="linked"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Wallet className="w-3 h-3" /> Linked Budgets
                </h4>
                {linkedBudgets.length > 0 ? linkedBudgets.map((b, i) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-xl bg-muted/15 hover:bg-muted/30 transition-all duration-300 flex justify-between mb-2 border border-transparent hover:border-border/30"
                  >
                    <span className="text-sm font-medium">{b.name}</span>
                    <span className="text-sm font-mono text-muted-foreground">{formatCurrency(Number(b.amount), b.currency)}</span>
                  </motion.div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No linked budgets</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" /> Savings Goals
                </h4>
                {savingsGoals.length > 0 ? savingsGoals.map((g, i) => {
                  const pct = Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100);
                  return (
                    <motion.div
                      key={g.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-3 rounded-xl bg-muted/15 hover:bg-muted/30 transition-all duration-300 mb-2 border border-transparent hover:border-border/30"
                    >
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">{g.icon || '🎯'} {g.name}</span>
                        <span className={`text-xs font-mono font-bold ${pct >= 80 ? 'text-income' : 'text-muted-foreground'}`}>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-income"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                        <span>{formatCurrency(Number(g.current_amount), g.currency)}</span>
                        <span>{formatCurrency(Number(g.target_amount), g.currency)}</span>
                      </div>
                    </motion.div>
                  );
                }) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No savings goals</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Audit */}
          {activeTab === 'audit' && (
            <motion.div
              key="audit"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-1.5"
            >
              {auditLogs.length > 0 ? auditLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-3 rounded-xl bg-muted/15 hover:bg-muted/30 transition-all duration-300 flex items-start justify-between border border-transparent hover:border-border/30"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">{log.action.replace('_', ' ')}</p>
                    {log.field_changed && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {log.field_changed}: <span className="text-expense">{log.old_value}</span> → <span className="text-income">{log.new_value}</span>
                      </p>
                    )}
                    {log.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{log.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {log.amount != null && (
                      <p className={`text-xs font-mono font-semibold ${Number(log.amount) >= 0 ? 'text-income' : 'text-expense'}`}>
                        {Number(log.amount) >= 0 ? '+' : ''}{formatCurrency(Number(log.amount), account.currency)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-14">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-muted/30 flex items-center justify-center">
                    <History className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No audit entries yet</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">Actions will be logged here</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
