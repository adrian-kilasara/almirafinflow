import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  TrendingUp, TrendingDown, ArrowLeft, Activity, History,
  Search, Download, BarChart3, AlertTriangle, Shield,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Account, Transaction, Budget, SavingsGoal, AccountAuditLog } from '@/types/finance';

interface AccountDetailPanelProps {
  account: Account;
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  onBack: () => void;
}

export default function AccountDetailPanel({
  account, transactions, budgets, savingsGoals, onBack,
}: AccountDetailPanelProps) {
  const [search, setSearch] = useState('');
  const [auditLogs, setAuditLogs] = useState<AccountAuditLog[]>([]);
  const [page, setPage] = useState(1);
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

  // Load audit logs
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

  // Stats
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

  // Linked budgets & goals
  const linkedBudgets = budgets.filter(b => {
    const budgetTxns = acctTxns.filter(t => t.category_id === b.category_id);
    return budgetTxns.length > 0;
  });

  // Monthly balance trend (last 6 months)
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

  // Account health
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: (account.color || '#14b8a6') + '20' }}
          >
            {account.icon || '💳'}
          </div>
          <div>
            <h2 className="text-xl font-bold">{account.name}</h2>
            <p className="text-sm text-muted-foreground capitalize">
              {isLiability ? '📉 Liability' : '📈 Asset'} · {account.type.replace('_', ' ')}
              {account.institution_name && ` · ${account.institution_name}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold font-mono ${isLiability ? 'text-expense' : ''}`}>
            {isLiability ? '-' : ''}{formatCurrency(Math.abs(Number(account.balance)), account.currency)}
          </p>
          <Badge variant={isLiability ? 'destructive' : 'default'} className="text-xs">
            {isLiability ? 'Liability' : 'Asset'}
          </Badge>
        </div>
      </div>

      {/* Health indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">7-Day Flow</p>
            <p className={`text-sm font-mono font-semibold ${stats7.net >= 0 ? 'text-income' : 'text-expense'}`}>
              {stats7.net >= 0 ? '+' : ''}{formatCurrency(stats7.net, account.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">30-Day Flow</p>
            <p className={`text-sm font-mono font-semibold ${stats30.net >= 0 ? 'text-income' : 'text-expense'}`}>
              {stats30.net >= 0 ? '+' : ''}{formatCurrency(stats30.net, account.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg Balance</p>
            <p className="text-sm font-mono font-semibold">{formatCurrency(avgBalance, account.currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              {isDormant ? (
                <span className="text-xs text-[hsl(var(--warning))] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Dormant
                </span>
              ) : volatility > avgBalance * 0.5 ? (
                <span className="text-xs text-expense flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Volatile
                </span>
              ) : (
                <span className="text-xs text-income flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Stable
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Trend Chart */}
      {balanceTrend.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Balance Trend (6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={balanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v, account.currency)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--card-foreground))' }}
                />
                <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="transactions">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="transactions">Transactions ({acctTxns.length})</TabsTrigger>
          <TabsTrigger value="linked">Linked</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          </div>

          {paginatedTxns.length > 0 ? (
            <div className="space-y-1">
              {paginatedTxns.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      t.type === 'income' ? 'bg-income/10' : t.type === 'expense' ? 'bg-expense/10' : 'bg-primary/10'
                    }`}>
                      {t.type === 'income' ? <TrendingUp className="w-4 h-4 text-income" /> :
                       t.type === 'expense' ? <TrendingDown className="w-4 h-4 text-expense" /> :
                       <Activity className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || t.type}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                  </div>
                  <p className={`font-mono text-sm font-semibold shrink-0 ${
                    t.type === 'income' ? 'text-income' : t.type === 'expense' ? 'text-expense' : 'text-primary'
                  }`}>
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(Number(t.amount), t.currency)}
                  </p>
                </div>
              ))}
              {filteredTxns.length > paginatedTxns.length && (
                <Button variant="ghost" className="w-full" onClick={() => setPage(p => p + 1)}>
                  Load more ({filteredTxns.length - paginatedTxns.length} remaining)
                </Button>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">No transactions found</p>
          )}
        </TabsContent>

        <TabsContent value="linked" className="mt-4 space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Linked Budgets</h4>
          {linkedBudgets.length > 0 ? linkedBudgets.map(b => (
            <div key={b.id} className="p-3 rounded-lg bg-muted/30 flex justify-between">
              <span className="text-sm">{b.name}</span>
              <span className="text-sm font-mono">{formatCurrency(Number(b.amount), b.currency)}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">No linked budgets</p>}

          <h4 className="text-sm font-semibold text-muted-foreground mt-4">Linked Savings Goals</h4>
          {savingsGoals.length > 0 ? savingsGoals.map(g => (
            <div key={g.id} className="p-3 rounded-lg bg-muted/30 flex justify-between">
              <span className="text-sm">{g.icon || '🎯'} {g.name}</span>
              <span className="text-sm font-mono">{formatCurrency(Number(g.current_amount), g.currency)} / {formatCurrency(Number(g.target_amount), g.currency)}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">No savings goals</p>}
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-2">
          {auditLogs.length > 0 ? auditLogs.map(log => (
            <div key={log.id} className="p-3 rounded-lg bg-muted/30 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium capitalize">{log.action.replace('_', ' ')}</p>
                {log.field_changed && (
                  <p className="text-xs text-muted-foreground">
                    {log.field_changed}: {log.old_value} → {log.new_value}
                  </p>
                )}
                {log.notes && <p className="text-xs text-muted-foreground">{log.notes}</p>}
              </div>
              <div className="text-right shrink-0">
                {log.amount != null && (
                  <p className={`text-xs font-mono ${Number(log.amount) >= 0 ? 'text-income' : 'text-expense'}`}>
                    {Number(log.amount) >= 0 ? '+' : ''}{formatCurrency(Number(log.amount), account.currency)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
              </div>
            </div>
          )) : (
            <div className="text-center py-8">
              <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No audit entries yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
