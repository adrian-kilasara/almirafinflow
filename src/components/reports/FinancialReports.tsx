import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Calendar } from 'lucide-react';
import type { Transaction, Account, Category } from '@/types/finance';
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, subDays, isWithinInterval, parseISO } from 'date-fns';

interface FinancialReportsProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

const COLORS = ['#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#6366f1'];

export default function FinancialReports({ transactions, accounts, categories }: FinancialReportsProps) {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case 'daily':
        startDate = subDays(now, 7);
        break;
      case 'weekly':
        startDate = subDays(now, 28);
        break;
      case 'monthly':
        startDate = subDays(now, 365);
        break;
    }

    return transactions.filter(t => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  }, [transactions, period]);

  const incomeVsExpense = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    return [
      { name: 'Income', value: income, fill: '#22c55e' },
      { name: 'Expenses', value: expense, fill: '#ef4444' },
    ];
  }, [filteredTransactions]);

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

  const trendData = useMemo(() => {
    const groupedData = new Map<string, { income: number; expense: number }>();

    filteredTransactions.forEach(t => {
      const date = parseISO(t.date);
      let key: string;

      switch (period) {
        case 'daily':
          key = format(date, 'EEE');
          break;
        case 'weekly':
          key = `W${format(date, 'w')}`;
          break;
        case 'monthly':
          key = format(date, 'MMM');
          break;
      }

      if (!groupedData.has(key)) {
        groupedData.set(key, { income: 0, expense: 0 });
      }

      const current = groupedData.get(key)!;
      if (t.type === 'income') {
        current.income += Number(t.amount);
      } else if (t.type === 'expense') {
        current.expense += Number(t.amount);
      }
    });

    return Array.from(groupedData.entries()).map(([name, data]) => ({
      name,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
    }));
  }, [filteredTransactions, period]);

  const accountDistribution = useMemo(() => {
    return accounts.map((account, index) => ({
      name: account.name,
      value: Number(account.balance),
      fill: COLORS[index % COLORS.length],
    })).filter(a => a.value > 0);
  }, [accounts]);

  const totalIncome = incomeVsExpense[0].value;
  const totalExpense = incomeVsExpense[1].value;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Financial Reports
        </h2>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="income">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Income</p>
            <p className="text-2xl font-bold text-income">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card variant="expense">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold text-expense">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Savings Rate</p>
            <p className={`text-2xl font-bold ${savingsRate >= 0 ? 'text-income' : 'text-expense'}`}>
              {savingsRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Trend */}
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
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="income" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                <Area type="monotone" dataKey="expense" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              </AreaChart>
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
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
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

        {/* Account Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" />
              Account Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accountDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={accountDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {accountDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No accounts with balance
              </div>
            )}
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
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                  {trendData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
