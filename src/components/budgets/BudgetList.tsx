import { useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { Wallet, Download, TrendingUp, TrendingDown, BarChart3, Shield, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Budget, Transaction, Category } from '@/types/finance';
import { isWithinInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useSettings } from '@/hooks/useSettings';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { convertTo } from '@/lib/currency';

interface BudgetListProps {
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
}

function getPeriodRange(period: string, budgetStartDate?: string | null) {
  const now = new Date();
  const budgetStart = budgetStartDate ? new Date(`${budgetStartDate}T00:00:00`) : null;
  let start: Date, end: Date;
  switch (period) {
    case 'daily':   start = startOfDay(now);   end = endOfDay(now);   break;
    case 'weekly':  start = startOfWeek(now);  end = endOfWeek(now);  break;
    case 'monthly': start = startOfMonth(now); end = endOfMonth(now); break;
    case 'yearly':  start = startOfYear(now);  end = endOfYear(now);  break;
    default:        start = startOfMonth(now); end = endOfMonth(now); break;
  }
  if (budgetStart && budgetStart > start) start = startOfDay(budgetStart);
  return { start, end };
}

export default function BudgetList({ budgets, transactions, categories }: BudgetListProps) {
  const { settings } = useSettings();
  const { rates } = useExchangeRates();
  const baseCurrency = settings.default_currency;

  const budgetsWithSpent = useMemo(() => {
    return budgets.map(budget => {
      const { start, end } = getPeriodRange(budget.period, (budget as any).start_date);
      const relevantTxns = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        if (t.currency !== budget.currency) return false;
        const d = parseISO(t.date);
        const inPeriod = isWithinInterval(d, { start, end });
        return budget.category_id ? inPeriod && t.category_id === budget.category_id : inPeriod;
      });
      const spent = relevantTxns.reduce((s, t) => s + Number(t.amount), 0);
      const budgetAmt = Number(budget.amount);
      const percentage = budgetAmt > 0 ? (spent / budgetAmt) * 100 : 0;
      const remaining = budgetAmt - spent;
      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (percentage >= 100) status = 'danger';
      else if (percentage >= 70) status = 'warning';
      return { ...budget, spent, percentage: Math.min(percentage, 100), rawPercentage: percentage, remaining, isOverBudget: spent > budgetAmt, category: categories.find(c => c.id === budget.category_id), status };
    });
  }, [budgets, transactions, categories]);

  // Convert each budget into base currency for cross-currency totals
  const totalBudget = budgetsWithSpent.reduce(
    (s, b) => s + convertTo(Number(b.amount), b.currency || baseCurrency, baseCurrency, rates),
    0
  );
  const totalSpent = budgetsWithSpent.reduce(
    (s, b) => s + convertTo(b.spent, b.currency || baseCurrency, baseCurrency, rates),
    0
  );
  const totalRemaining = totalBudget - totalSpent;
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overBudgetCount = budgetsWithSpent.filter(b => b.isOverBudget).length;
  const safeCount = budgetsWithSpent.filter(b => b.status === 'safe').length;
  const warningCount = budgetsWithSpent.filter(b => b.status === 'warning').length;
  const distinctCurrencies = Array.from(new Set(budgets.map(b => b.currency || baseCurrency)));

  const overallColor = overallPercent >= 100 ? 'hsl(var(--expense))' : overallPercent >= 70 ? 'hsl(var(--warning))' : 'hsl(var(--income))';

  // Circular progress
  const circleRadius = 52;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (Math.min(overallPercent, 100) / 100) * circumference;

  const exportCSV = useCallback(() => {
    const rows = [
      ['Budget', 'Category', 'Period', 'Budget Amount', 'Spent', 'Remaining', 'Status'].join(','),
      ...budgetsWithSpent.map(b => [
        `"${b.name}"`, `"${b.category?.name || 'All'}"`, b.period, b.amount, b.spent.toFixed(2), b.remaining.toFixed(2), b.status,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budgets-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [budgetsWithSpent]);

  if (budgets.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
              <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
            </motion.div>
            <p className="font-bold">No budgets set</p>
            <p className="text-sm text-muted-foreground mt-1">Create a budget to track your spending</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero Overview Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <Card className="relative overflow-hidden border-primary/10">
          {/* Ambient */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-income/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />

          <CardContent className="relative p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Circular gauge */}
              <div className="relative w-32 h-32 mx-auto sm:mx-0 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={circleRadius} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" strokeOpacity="0.25" />
                  <motion.circle
                    cx="60" cy="60" r={circleRadius}
                    fill="none"
                    stroke={overallColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ delay: 0.2, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-2xl font-extrabold font-mono"
                    style={{ color: overallColor }}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {Math.round(overallPercent)}%
                  </motion.span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">used</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="p-3 rounded-xl bg-muted/20 border border-border/20">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Total Budget</p>
                    <p className="text-lg font-bold font-mono">{formatCurrency(totalBudget, baseCurrency)}</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="p-3 rounded-xl bg-muted/20 border border-border/20">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Total Spent</p>
                    <p className="text-lg font-bold font-mono" style={{ color: overallColor }}>{formatCurrency(totalSpent, baseCurrency)}</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                    className="p-3 rounded-xl bg-muted/20 border border-border/20">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Remaining</p>
                    <p className={`text-lg font-bold font-mono ${totalRemaining >= 0 ? 'text-income' : 'text-expense'}`}>
                      {formatCurrency(totalRemaining, baseCurrency)}
                    </p>
                  </motion.div>
                </div>
                {distinctCurrencies.length > 1 && (
                  <p className="text-[10px] text-muted-foreground">
                    Totals shown in <span className="font-semibold text-primary">{baseCurrency}</span> · converted from {distinctCurrencies.join(', ')}
                  </p>
                )}

                {/* Status pills */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-income/5 border border-income/15 text-income font-medium">
                    <Shield className="w-3 h-3" /> {safeCount} On Track
                  </div>
                  {warningCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] font-medium">
                      <AlertTriangle className="w-3 h-3" /> {warningCount} Caution
                    </div>
                  )}
                  {overBudgetCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-expense/5 border border-expense/15 text-expense font-medium">
                      <TrendingDown className="w-3 h-3" /> {overBudgetCount} Over
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={exportCSV} className="ml-auto gap-1 text-[10px] h-7 px-2 rounded-lg">
                    <Download className="w-3 h-3" /> Export
                  </Button>
                </motion.div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Budget vs Actual Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-3 h-3 text-primary" />
              </div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Budget vs Actual</h3>
            </div>

            <div className="space-y-2">
              {budgetsWithSpent.map((b, i) => {
                const statusColor = b.status === 'danger' ? 'hsl(var(--expense))' : b.status === 'warning' ? 'hsl(var(--warning))' : 'hsl(var(--income))';
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.04 }}
                    className="p-3 rounded-xl bg-muted/10 hover:bg-muted/25 transition-all border border-transparent hover:border-border/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {b.category?.icon && <span className="text-sm">{b.category.icon}</span>}
                        <span className="text-sm font-medium truncate">{b.name}</span>
                        <span className="text-[9px] text-muted-foreground capitalize">{b.period}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono text-muted-foreground">{formatCurrency(Number(b.amount), b.currency)}</span>
                        <span className="text-xs font-mono font-bold" style={{ color: statusColor }}>
                          {Math.round(b.rawPercentage)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-muted/30">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: statusColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${b.percentage}%` }}
                        transition={{ delay: 0.5 + i * 0.05, duration: 0.6 }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                      <span>Spent: <span className="font-mono font-semibold" style={{ color: statusColor }}>{formatCurrency(b.spent, b.currency)}</span></span>
                      <span className={b.remaining >= 0 ? 'text-income' : 'text-expense'}>
                        {b.remaining >= 0 ? `${formatCurrency(b.remaining, b.currency)} left` : `${formatCurrency(Math.abs(b.remaining), b.currency)} over`}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
