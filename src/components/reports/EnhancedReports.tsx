import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
import { 
  BarChart3, PieChart as PieChartIcon, TrendingUp, Calendar,
  FileText, Table as TableIcon
} from 'lucide-react';
import type { Transaction, Account, Category, Budget } from '@/types/finance';
import { 
  format, startOfDay, startOfWeek, startOfMonth, startOfYear,
  endOfDay, endOfWeek, endOfMonth, endOfYear,
  subDays, subWeeks, subMonths, subYears,
  isWithinInterval, parseISO
} from 'date-fns';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface EnhancedReportsProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'annual';

const COLORS = ['#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#6366f1'];

export default function EnhancedReports({ 
  transactions, 
  accounts, 
  categories,
  budgets 
}: EnhancedReportsProps) {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');

  const { dateRange, filteredTransactions } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (period) {
      case 'daily':
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        break;
      case 'weekly':
        start = startOfWeek(subWeeks(now, 3));
        end = endOfWeek(now);
        break;
      case 'monthly':
        start = startOfMonth(subMonths(now, 11));
        end = endOfMonth(now);
        break;
      case 'annual':
        start = startOfYear(subYears(now, 2));
        end = endOfYear(now);
        break;
    }

    const filtered = transactions.filter(t => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start, end });
    });

    return { dateRange: { start, end }, filteredTransactions: filtered };
  }, [transactions, period]);

  // Income vs Expense
  const incomeVsExpense = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    return { income, expense, savings: income - expense, savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0 };
  }, [filteredTransactions]);

  // Expenses by Category
  const expensesByCategory = useMemo(() => {
    const expenseTransactions = filteredTransactions.filter(t => t.type === 'expense');
    const categoryMap = new Map<string, number>();

    expenseTransactions.forEach(t => {
      const category = categories.find(c => c.id === t.category_id);
      const categoryName = category?.name || 'Uncategorized';
      categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + Number(t.amount));
    });

    return Array.from(categoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value,
        fill: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categories]);

  // Trend Data
  const trendData = useMemo(() => {
    const groupedData = new Map<string, { income: number; expense: number; date: Date }>();

    filteredTransactions.forEach(t => {
      const date = parseISO(t.date);
      let key: string;

      switch (period) {
        case 'daily':
          key = format(date, 'EEE dd');
          break;
        case 'weekly':
          key = `W${format(date, 'w')}`;
          break;
        case 'monthly':
          key = format(date, 'MMM yy');
          break;
        case 'annual':
          key = format(date, 'yyyy');
          break;
      }

      if (!groupedData.has(key)) {
        groupedData.set(key, { income: 0, expense: 0, date });
      }

      const current = groupedData.get(key)!;
      if (t.type === 'income') {
        current.income += Number(t.amount);
      } else if (t.type === 'expense') {
        current.expense += Number(t.amount);
      }
    });

    return Array.from(groupedData.entries())
      .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
      .map(([name, data]) => ({
        name,
        income: data.income,
        expense: data.expense,
        net: data.income - data.expense,
      }));
  }, [filteredTransactions, period]);

  // Budget Performance - match the budget period to selected report period for accuracy
  const budgetPerformance = useMemo(() => {
    const now = new Date();
    
    return budgets.map(budget => {
      // Calculate the correct date range for THIS budget's period
      let budgetStart: Date;
      let budgetEnd: Date;
      
      switch (budget.period) {
        case 'daily':
          budgetStart = startOfDay(now);
          budgetEnd = endOfDay(now);
          break;
        case 'weekly':
          budgetStart = startOfWeek(now);
          budgetEnd = endOfWeek(now);
          break;
        case 'monthly':
          budgetStart = startOfMonth(now);
          budgetEnd = endOfMonth(now);
          break;
        case 'yearly':
          budgetStart = startOfYear(now);
          budgetEnd = endOfYear(now);
          break;
      }
      
      // Filter transactions within budget's own period for accurate tracking
      const budgetTransactions = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const d = parseISO(t.date);
        const withinPeriod = isWithinInterval(d, { start: budgetStart, end: budgetEnd });
        if (budget.category_id) {
          return withinPeriod && t.category_id === budget.category_id;
        }
        return withinPeriod;
      });
      
      const spent = budgetTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const percentage = (spent / Number(budget.amount)) * 100;
      const category = categories.find(c => c.id === budget.category_id);
      
      return {
        name: budget.name,
        category: category?.name || 'General',
        period: budget.period,
        budgeted: Number(budget.amount),
        spent,
        remaining: Number(budget.amount) - spent,
        percentage: Math.min(percentage, 150),
        isOver: spent > Number(budget.amount),
      };
    });
  }, [budgets, transactions, categories]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Description', 'Account'];
    const rows = filteredTransactions.map(t => {
      const category = categories.find(c => c.id === t.category_id);
      const account = accounts.find(a => a.id === t.account_id);
      return [
        t.date,
        t.type,
        t.amount.toString(),
        t.currency,
        category?.name || 'Uncategorized',
        t.description || '',
        account?.name || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `finflow-report-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Report exported successfully!');
  };

  // Export Summary to Text
  const exportSummary = () => {
    const summary = `
FinFlow 2026 - Financial Report
Period: ${period.charAt(0).toUpperCase() + period.slice(1)}
Generated: ${format(new Date(), 'PPpp')}

═══════════════════════════════════════
SUMMARY
═══════════════════════════════════════
Total Income: ${formatCurrency(incomeVsExpense.income)}
Total Expenses: ${formatCurrency(incomeVsExpense.expense)}
Net Savings: ${formatCurrency(incomeVsExpense.savings)}
Savings Rate: ${incomeVsExpense.savingsRate.toFixed(1)}%

═══════════════════════════════════════
TOP EXPENSE CATEGORIES
═══════════════════════════════════════
${expensesByCategory.slice(0, 5).map((c, i) => `${i + 1}. ${c.name}: ${formatCurrency(c.value)}`).join('\n')}

═══════════════════════════════════════
BUDGET PERFORMANCE
═══════════════════════════════════════
${budgetPerformance.map(b => `${b.name} (${b.period}): ${formatCurrency(b.spent)} / ${formatCurrency(b.budgeted)} (${b.percentage.toFixed(0)}%)${b.isOver ? ' ⚠️ OVER BUDGET' : ''}`).join('\n')}

═══════════════════════════════════════
ACCOUNT BALANCES
═══════════════════════════════════════
${accounts.map(a => `${a.name} (${a.type}): ${formatCurrency(Number(a.balance), a.currency)}`).join('\n')}

Total Net Worth: ${formatCurrency(accounts.reduce((sum, a) => sum + Number(a.balance), 0))}
    `.trim();

    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `finflow-summary-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    link.click();
    toast.success('Summary exported successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Financial Reports
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['daily', 'weekly', 'monthly', 'annual'] as ReportPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <TableIcon className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportSummary}>
            <FileText className="w-4 h-4 mr-1" />
            Summary
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="income">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold text-income">{formatCurrency(incomeVsExpense.income)}</p>
          </CardContent>
        </Card>
        <Card variant="expense">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-expense">{formatCurrency(incomeVsExpense.expense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net Savings</p>
            <p className={`text-xl font-bold ${incomeVsExpense.savings >= 0 ? 'text-income' : 'text-expense'}`}>
              {incomeVsExpense.savings >= 0 ? '+' : ''}{formatCurrency(incomeVsExpense.savings)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Savings Rate</p>
            <p className={`text-xl font-bold ${incomeVsExpense.savingsRate >= 20 ? 'text-income' : incomeVsExpense.savingsRate >= 10 ? 'text-warning' : 'text-expense'}`}>
              {incomeVsExpense.savingsRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              Cash Flow Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="income" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Income" />
                <Area type="monotone" dataKey="expense" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Net Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" />
              Net Cash Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Net Flow">
                  {trendData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="w-4 h-4" />
              Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No expense data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Performance - uses each budget's own period */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" />
              Budget Performance (Current Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budgetPerformance.length > 0 ? (
              <div className="space-y-3">
                {budgetPerformance.map((budget, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {budget.name}
                        <span className="text-xs text-muted-foreground ml-1">({budget.period})</span>
                      </span>
                      <span className={budget.isOver ? 'text-expense' : 'text-muted-foreground'}>
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.budgeted)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          budget.isOver ? 'bg-expense' : budget.percentage > 80 ? 'bg-warning' : 'bg-income'
                        }`}
                        style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{budget.percentage.toFixed(0)}% used</span>
                      <span className={budget.remaining >= 0 ? '' : 'text-expense'}>
                        {budget.remaining >= 0 ? `${formatCurrency(budget.remaining)} left` : `${formatCurrency(Math.abs(budget.remaining))} over`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No budgets set up yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Expenses This Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredTransactions
              .filter(t => t.type === 'expense')
              .sort((a, b) => Number(b.amount) - Number(a.amount))
              .slice(0, 10)
              .map((t, index) => {
                const category = categories.find(c => c.id === t.category_id);
                return (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm w-6">{index + 1}.</span>
                      <div>
                        <p className="font-medium text-sm">{t.description || 'No description'}</p>
                        <p className="text-xs text-muted-foreground">
                          {category?.name || 'Uncategorized'} • {formatDate(t.date)}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-expense">
                      -{formatCurrency(Number(t.amount), t.currency)}
                    </span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
