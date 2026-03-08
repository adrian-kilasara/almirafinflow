import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { Wallet, AlertTriangle, TrendingUp, TrendingDown, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Budget, Transaction, Category } from '@/types/finance';
import { isWithinInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

interface BudgetListProps {
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
}

function getPeriodRange(period: string) {
  const now = new Date();
  switch (period) {
    case 'daily': return { start: startOfDay(now), end: endOfDay(now) };
    case 'weekly': return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'monthly': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'yearly': return { start: startOfYear(now), end: endOfYear(now) };
    default: return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default function BudgetList({ budgets, transactions, categories }: BudgetListProps) {
  const budgetsWithSpent = useMemo(() => {
    return budgets.map(budget => {
      const { start, end } = getPeriodRange(budget.period);
      const relevantTxns = transactions.filter(t => {
        if (t.type !== 'expense') return false;
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

      return {
        ...budget,
        spent,
        percentage: Math.min(percentage, 100),
        rawPercentage: percentage,
        remaining,
        isOverBudget: spent > budgetAmt,
        category: categories.find(c => c.id === budget.category_id),
        status,
      };
    });
  }, [budgets, transactions, categories]);

  // Summary
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgetsWithSpent.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overBudgetCount = budgetsWithSpent.filter(b => b.isOverBudget).length;
  const warningCount = budgetsWithSpent.filter(b => b.status === 'warning').length;

  let overallStatus: 'safe' | 'warning' | 'danger' = 'safe';
  if (overallPercent >= 100) overallStatus = 'danger';
  else if (overallPercent >= 70) overallStatus = 'warning';

  const statusColors = {
    safe: 'text-income',
    warning: 'text-[hsl(var(--warning))]',
    danger: 'text-expense',
  };

  // Export
  const exportCSV = useCallback(() => {
    const rows = [
      ['Budget', 'Category', 'Period', 'Budget Amount', 'Spent', 'Remaining', 'Status'].join(','),
      ...budgetsWithSpent.map(b => [
        `"${b.name}"`,
        `"${b.category?.name || 'All'}"`,
        b.period,
        b.amount,
        b.spent.toFixed(2),
        b.remaining.toFixed(2),
        b.status,
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
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No budgets set</p>
          <p className="text-sm">Create a budget to track your spending</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview Dashboard */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Budget Overview</h3>
            <div className="flex items-center gap-2">
              {overBudgetCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {overBudgetCount} over budget
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="outline" className="text-xs border-[hsl(var(--warning))] text-[hsl(var(--warning))]">
                  {warningCount} warning
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={exportCSV} className="gap-1 text-xs">
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Budget</p>
              <p className="text-lg font-bold font-mono">{formatCurrency(totalBudget)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className={cn("text-lg font-bold font-mono", statusColors[overallStatus])}>
                {formatCurrency(totalSpent)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className={cn("text-lg font-bold font-mono", totalRemaining >= 0 ? 'text-income' : 'text-expense')}>
                {formatCurrency(totalRemaining)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Overall Usage</span>
              <span className={statusColors[overallStatus]}>{Math.round(overallPercent)}%</span>
            </div>
            <Progress
              value={Math.min(overallPercent, 100)}
              className={cn("h-3", overallStatus === 'danger' ? '[&>div]:bg-destructive' : overallStatus === 'warning' ? '[&>div]:bg-[hsl(var(--warning))]' : '')}
            />
            <div className="flex justify-between text-[11px]">
              <span className="text-income">🟢 Safe (0-70%)</span>
              <span className="text-[hsl(var(--warning))]">🟡 Warning (70-90%)</span>
              <span className="text-expense">🔴 Over (100%+)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget vs Actual Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Budget vs Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0.5">
            <div className="grid grid-cols-[1fr_90px_90px_90px_50px] gap-2 text-xs text-muted-foreground font-medium pb-2 border-b border-border">
              <span>Category</span>
              <span className="text-right">Budget</span>
              <span className="text-right">Actual</span>
              <span className="text-right">Diff</span>
              <span className="text-right">%</span>
            </div>
            {budgetsWithSpent.map(b => (
              <div key={b.id} className="grid grid-cols-[1fr_90px_90px_90px_50px] gap-2 text-xs py-2 border-b border-border/50 items-center">
                <div className="flex items-center gap-1.5 truncate">
                  {b.category?.icon && <span>{b.category.icon}</span>}
                  <span className="truncate font-medium">{b.name}</span>
                </div>
                <span className="text-right font-mono">{formatCurrency(Number(b.amount), b.currency)}</span>
                <span className={cn("text-right font-mono", statusColors[b.status])}>{formatCurrency(b.spent, b.currency)}</span>
                <span className={cn("text-right font-mono", b.remaining >= 0 ? 'text-income' : 'text-expense')}>
                  {b.remaining >= 0 ? '+' : ''}{formatCurrency(b.remaining, b.currency)}
                </span>
                <span className={cn("text-right font-mono", statusColors[b.status])}>
                  {Math.round(b.rawPercentage)}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
