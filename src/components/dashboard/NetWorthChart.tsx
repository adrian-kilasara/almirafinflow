import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, getMonthName } from '@/lib/format';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Account, Transaction } from '@/types/finance';

interface NetWorthChartProps {
  accounts: Account[];
  transactions: Transaction[];
}

export default function NetWorthChart({ accounts, transactions }: NetWorthChartProps) {
  const chartData = useMemo(() => {
    if (accounts.length === 0) return [];

    // Current net worth
    const currentNetWorth = accounts.reduce((s, a) => {
      const bal = Number(a.balance);
      return a.classification === 'liability' ? s - Math.abs(bal) : s + bal;
    }, 0);

    // Build monthly net worth by working backwards from current balance
    const now = new Date();
    const months = 12;
    const data: { month: string; netWorth: number; assets: number; liabilities: number }[] = [];

    // Group transactions by month
    const monthlyChanges: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(t => {
      const key = t.date.substring(0, 7); // YYYY-MM
      if (!monthlyChanges[key]) monthlyChanges[key] = { income: 0, expense: 0 };
      if (t.type === 'income') monthlyChanges[key].income += Number(t.amount);
      else if (t.type === 'expense') monthlyChanges[key].expense += Number(t.amount);
    });

    // Calculate backward from current net worth
    let runningNetWorth = currentNetWorth;
    const totalAssets = accounts.filter(a => a.classification !== 'liability').reduce((s, a) => s + Number(a.balance), 0);
    const totalLiabilities = accounts.filter(a => a.classification === 'liability').reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
    let runningAssets = totalAssets;
    let runningLiabilities = totalLiabilities;

    // Current month first
    const entries: typeof data = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${getMonthName(d.getMonth())} ${d.getFullYear().toString().slice(-2)}`;

      if (i === 0) {
        entries.unshift({ month: label, netWorth: runningNetWorth, assets: runningAssets, liabilities: runningLiabilities });
      } else {
        // Subtract this month's net change to get previous month's value
        const change = monthlyChanges[key] || { income: 0, expense: 0 };
        const netChange = change.income - change.expense;
        runningNetWorth -= netChange;
        runningAssets -= change.income;
        runningLiabilities -= change.expense * 0.1; // Rough estimate
        entries.unshift({
          month: label,
          netWorth: Math.max(0, runningNetWorth),
          assets: Math.max(0, runningAssets),
          liabilities: Math.max(0, runningLiabilities),
        });
      }
    }

    return entries;
  }, [accounts, transactions]);

  const currentNetWorth = accounts.reduce((s, a) => {
    const bal = Number(a.balance);
    return a.classification === 'liability' ? s - Math.abs(bal) : s + bal;
  }, 0);

  const totalAssets = accounts.filter(a => a.classification !== 'liability').reduce((s, a) => s + Number(a.balance), 0);
  const totalLiabilities = accounts.filter(a => a.classification === 'liability').reduce((s, a) => s + Math.abs(Number(a.balance)), 0);

  const prevMonthWorth = chartData.length >= 2 ? chartData[chartData.length - 2].netWorth : currentNetWorth;
  const monthChange = currentNetWorth - prevMonthWorth;
  const monthChangePct = prevMonthWorth > 0 ? ((monthChange / prevMonthWorth) * 100).toFixed(1) : '0';

  if (accounts.length === 0) return null;

  return (
    <Card className="border-primary/10 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-primary" />
            </div>
            Net Worth Tracker
          </div>
          <div className="text-right">
            <p className={`text-xs font-mono flex items-center gap-1 ${monthChange >= 0 ? 'text-income' : 'text-expense'}`}>
              {monthChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {monthChange >= 0 ? '+' : ''}{monthChangePct}% this month
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* Net Worth Breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-muted/30 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Assets</p>
            <p className="text-sm font-bold font-mono text-income">{formatCurrency(totalAssets)}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-muted/30 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Liabilities</p>
            <p className="text-sm font-bold font-mono text-expense">{formatCurrency(totalLiabilities)}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/10 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Net Worth</p>
            <p className={`text-sm font-bold font-mono ${currentNetWorth >= 0 ? 'text-primary' : 'text-expense'}`}>{formatCurrency(currentNetWorth)}</p>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                  <defs>
                    <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                  />
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#netWorthGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
