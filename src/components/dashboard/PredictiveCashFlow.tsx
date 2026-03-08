import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { TrendingDown, AlertTriangle, Calendar, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Account, Transaction } from '@/types/finance';

interface PredictiveCashFlowProps {
  accounts: Account[];
  transactions: Transaction[];
}

export default function PredictiveCashFlow({ accounts, transactions }: PredictiveCashFlowProps) {
  const predictions = useMemo(() => {
    const now = new Date();
    const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

    // Average daily spend over last 30 days
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

    const last30Expenses = transactions.filter(
      t => t.type === 'expense' && t.date >= thirtyStr
    );
    const last30Income = transactions.filter(
      t => t.type === 'income' && t.date >= thirtyStr
    );

    const totalExpenses30 = last30Expenses.reduce((s, t) => s + Number(t.amount), 0);
    const totalIncome30 = last30Income.reduce((s, t) => s + Number(t.amount), 0);
    const avgDailyExpense = totalExpenses30 / 30;
    const avgDailyIncome = totalIncome30 / 30;
    const avgDailyNet = avgDailyIncome - avgDailyExpense;

    // Project balance for next 30 days
    const projections: { day: number; date: string; balance: number }[] = [];
    let projBalance = totalBalance;
    let lowBalanceDay: string | null = null;
    let zeroDay: string | null = null;

    for (let i = 1; i <= 30; i++) {
      projBalance += avgDailyNet;
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      projections.push({ day: i, date: dateStr, balance: projBalance });

      if (projBalance < 10000 && !lowBalanceDay) lowBalanceDay = dateStr;
      if (projBalance <= 0 && !zeroDay) zeroDay = dateStr;
    }

    // Day-of-week spending patterns
    const daySpending = Array(7).fill(0);
    const dayCounts = Array(7).fill(0);
    last30Expenses.forEach(t => {
      const dayOfWeek = new Date(t.date).getDay();
      daySpending[dayOfWeek] += Number(t.amount);
      dayCounts[dayOfWeek]++;
    });
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const spendingPattern = dayNames.map((name, i) => ({
      day: name,
      avg: dayCounts[i] > 0 ? daySpending[i] / dayCounts[i] : 0,
    }));
    const peakSpendDay = spendingPattern.reduce((a, b) => a.avg > b.avg ? a : b);

    // Runway (how many days until balance = 0 at current burn)
    const runway = avgDailyExpense > avgDailyIncome
      ? Math.round(totalBalance / (avgDailyExpense - avgDailyIncome))
      : null;

    return {
      totalBalance,
      avgDailyExpense,
      avgDailyIncome,
      avgDailyNet,
      projections,
      lowBalanceDay,
      zeroDay,
      peakSpendDay,
      runway,
    };
  }, [accounts, transactions]);

  const minProjectedBalance = Math.min(...predictions.projections.map(p => p.balance));
  const maxProjectedBalance = Math.max(...predictions.projections.map(p => p.balance), predictions.totalBalance);
  const range = maxProjectedBalance - Math.min(minProjectedBalance, 0);

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-3 h-3 text-primary" />
          </div>
          Predictive Cash Flow
          <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">30-day forecast</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alerts */}
        {predictions.zeroDay && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-destructive/5 border border-destructive/20"
          >
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <p className="text-xs font-bold text-destructive">Balance Depletion Warning</p>
              <p className="text-[10px] text-muted-foreground">
                At current rate, your balance will reach zero by <span className="font-semibold text-foreground">{predictions.zeroDay}</span>
              </p>
            </div>
          </motion.div>
        )}

        {!predictions.zeroDay && predictions.lowBalanceDay && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/20"
          >
            <TrendingDown className="w-4 h-4 text-[hsl(var(--warning))] shrink-0" />
            <div>
              <p className="text-xs font-bold">Low Balance Predicted</p>
              <p className="text-[10px] text-muted-foreground">
                Balance may drop below threshold by <span className="font-semibold text-foreground">{predictions.lowBalanceDay}</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Daily Income', value: formatCurrency(predictions.avgDailyIncome), color: 'text-income' },
            { label: 'Daily Spend', value: formatCurrency(predictions.avgDailyExpense), color: 'text-expense' },
            { label: 'Net/Day', value: `${predictions.avgDailyNet >= 0 ? '+' : ''}${formatCurrency(predictions.avgDailyNet)}`, color: predictions.avgDailyNet >= 0 ? 'text-income' : 'text-expense' },
            { label: 'Peak Day', value: predictions.peakSpendDay.day, color: 'text-primary' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-2 rounded-xl bg-muted/20 text-center"
            >
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-[11px] font-bold font-mono ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Mini projection chart */}
        <div className="relative h-24 rounded-xl bg-muted/10 border border-border/20 overflow-hidden p-2">
          <svg width="100%" height="100%" viewBox="0 0 300 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cashflow-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Area */}
            <motion.path
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2 }}
              d={(() => {
                const points = predictions.projections.map((p, i) => {
                  const x = (i / 29) * 300;
                  const y = 80 - ((p.balance - Math.min(minProjectedBalance, 0)) / range) * 70;
                  return `${x},${y}`;
                });
                return `M${points.join(' L')} L300,80 L0,80 Z`;
              })()}
              fill="url(#cashflow-grad)"
            />
            {/* Line */}
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: 0.2 }}
              d={(() => {
                const points = predictions.projections.map((p, i) => {
                  const x = (i / 29) * 300;
                  const y = 80 - ((p.balance - Math.min(minProjectedBalance, 0)) / range) * 70;
                  return `${x},${y}`;
                });
                return `M${points.join(' L')}`;
              })()}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
            {/* Zero line */}
            {minProjectedBalance < 0 && (
              <line
                x1="0"
                y1={80 - ((-Math.min(minProjectedBalance, 0)) / range) * 70}
                x2="300"
                y2={80 - ((-Math.min(minProjectedBalance, 0)) / range) * 70}
                stroke="hsl(var(--destructive))"
                strokeWidth="1"
                strokeDasharray="4"
                opacity="0.5"
              />
            )}
          </svg>

          {/* Date labels */}
          <div className="absolute bottom-0 left-2 right-2 flex justify-between">
            <span className="text-[8px] text-muted-foreground">Today</span>
            <span className="text-[8px] text-muted-foreground">+30 days</span>
          </div>
        </div>

        {/* Runway */}
        {predictions.runway !== null && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/20">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              Financial runway: <span className="font-bold text-foreground">{predictions.runway} days</span> at current burn rate
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
