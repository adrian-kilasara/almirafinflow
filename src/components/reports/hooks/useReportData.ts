import { useMemo } from 'react';
import type { Transaction, Account, Category, Budget, SavingsGoal } from '@/types/finance';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, startOfQuarter, endOfQuarter,
  subDays, subWeeks, subMonths, subQuarters, subYears,
  isWithinInterval, parseISO, format, differenceInDays
} from 'date-fns';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface PeriodRange { start: Date; end: Date; }
export interface PeriodPair { current: PeriodRange; previous: PeriodRange; }

export function getPeriodRanges(period: ReportPeriod): PeriodPair {
  const now = new Date();
  switch (period) {
    case 'daily': return {
      current: { start: startOfDay(now), end: endOfDay(now) },
      previous: { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) },
    };
    case 'weekly': return {
      current: { start: startOfWeek(now), end: endOfWeek(now) },
      previous: { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) },
    };
    case 'monthly': return {
      current: { start: startOfMonth(now), end: endOfMonth(now) },
      previous: { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) },
    };
    case 'quarterly': return {
      current: { start: startOfQuarter(now), end: endOfQuarter(now) },
      previous: { start: startOfQuarter(subQuarters(now, 1)), end: endOfQuarter(subQuarters(now, 1)) },
    };
    case 'annual': return {
      current: { start: startOfYear(now), end: endOfYear(now) },
      previous: { start: startOfYear(subYears(now, 1)), end: endOfYear(subYears(now, 1)) },
    };
  }
}

function filterByRange(transactions: Transaction[], range: PeriodRange) {
  return transactions.filter(t => {
    const d = parseISO(t.date);
    return isWithinInterval(d, { start: range.start, end: range.end });
  });
}

function calcMetrics(txns: Transaction[]) {
  const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  return { income, expense, net: income - expense, savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0 };
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export interface CategorySpend { name: string; value: number; fill: string; pctOfTotal: number; }
export interface TrendPoint { name: string; income: number; expense: number; net: number; date: Date; }
export interface BudgetPerf { name: string; category: string; period: string; budgeted: number; spent: number; remaining: number; percentage: number; isOver: boolean; }

const COLORS = ['#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#84cc16'];

export function useReportData(
  transactions: Transaction[], accounts: Account[], categories: Category[],
  budgets: Budget[], savingsGoals: SavingsGoal[], period: ReportPeriod
) {
  const ranges = useMemo(() => getPeriodRanges(period), [period]);

  const currentTxns = useMemo(() => filterByRange(transactions, ranges.current), [transactions, ranges]);
  const previousTxns = useMemo(() => filterByRange(transactions, ranges.previous), [transactions, ranges]);

  const current = useMemo(() => calcMetrics(currentTxns), [currentTxns]);
  const previous = useMemo(() => calcMetrics(previousTxns), [previousTxns]);

  const changes = useMemo(() => ({
    income: pctChange(current.income, previous.income),
    expense: pctChange(current.expense, previous.expense),
    net: pctChange(current.net, previous.net),
    savingsRate: current.savingsRate - previous.savingsRate,
  }), [current, previous]);

  // Category breakdown
  const categoryBreakdown = useMemo<CategorySpend[]>(() => {
    const expTxns = currentTxns.filter(t => t.type === 'expense');
    const total = expTxns.reduce((s, t) => s + Number(t.amount), 0);
    const map = new Map<string, number>();
    expTxns.forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const name = cat?.name || 'Uncategorized';
      map.set(name, (map.get(name) || 0) + Number(t.amount));
    });
    return Array.from(map.entries())
      .map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length], pctOfTotal: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [currentTxns, categories]);

  // Trend data (for charts within current period context)
  const trendData = useMemo<TrendPoint[]>(() => {
    // For daily: show last 7 days; weekly: last 4 weeks; monthly: last 12 months; quarterly: last 4 quarters; annual: last 3 years
    const now = new Date();
    let rangeStart: Date;
    switch (period) {
      case 'daily': rangeStart = startOfDay(subDays(now, 6)); break;
      case 'weekly': rangeStart = startOfWeek(subWeeks(now, 3)); break;
      case 'monthly': rangeStart = startOfMonth(subMonths(now, 11)); break;
      case 'quarterly': rangeStart = startOfQuarter(subQuarters(now, 3)); break;
      case 'annual': rangeStart = startOfYear(subYears(now, 2)); break;
    }
    const trendTxns = transactions.filter(t => {
      const d = parseISO(t.date);
      return isWithinInterval(d, { start: rangeStart, end: now });
    });
    const grouped = new Map<string, { income: number; expense: number; date: Date }>();
    trendTxns.forEach(t => {
      const d = parseISO(t.date);
      let key: string;
      switch (period) {
        case 'daily': key = format(d, 'EEE dd'); break;
        case 'weekly': key = `W${format(d, 'w')}`; break;
        case 'monthly': key = format(d, 'MMM yy'); break;
        case 'quarterly': key = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${format(d, 'yy')}`; break;
        case 'annual': key = format(d, 'yyyy'); break;
      }
      if (!grouped.has(key)) grouped.set(key, { income: 0, expense: 0, date: d });
      const c = grouped.get(key)!;
      if (t.type === 'income') c.income += Number(t.amount);
      else if (t.type === 'expense') c.expense += Number(t.amount);
    });
    return Array.from(grouped.entries())
      .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
      .map(([name, data]) => ({ name, income: data.income, expense: data.expense, net: data.income - data.expense, date: data.date }));
  }, [transactions, period]);

  // Budget performance (uses each budget's own period)
  const budgetPerformance = useMemo<BudgetPerf[]>(() => {
    const now = new Date();
    return budgets.map(budget => {
      let bs: Date, be: Date;
      switch (budget.period) {
        case 'daily': bs = startOfDay(now); be = endOfDay(now); break;
        case 'weekly': bs = startOfWeek(now); be = endOfWeek(now); break;
        case 'monthly': bs = startOfMonth(now); be = endOfMonth(now); break;
        case 'yearly': bs = startOfYear(now); be = endOfYear(now); break;
      }
      const spent = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const d = parseISO(t.date);
        const inRange = isWithinInterval(d, { start: bs, end: be });
        return budget.category_id ? inRange && t.category_id === budget.category_id : inRange;
      }).reduce((s, t) => s + Number(t.amount), 0);
      const pct = (spent / Number(budget.amount)) * 100;
      const cat = categories.find(c => c.id === budget.category_id);
      return { name: budget.name, category: cat?.name || 'General', period: budget.period, budgeted: Number(budget.amount), spent, remaining: Number(budget.amount) - spent, percentage: Math.min(pct, 150), isOver: spent > Number(budget.amount) };
    });
  }, [budgets, transactions, categories]);

  // Account type breakdown (mobile money vs bank vs cash)
  const accountBreakdown = useMemo(() => {
    const map = new Map<string, { balance: number; count: number }>();
    accounts.forEach(a => {
      const entry = map.get(a.type) || { balance: 0, count: 0 };
      entry.balance += Number(a.balance);
      entry.count++;
      map.set(a.type, entry);
    });
    return Array.from(map.entries()).map(([type, data]) => ({ type, ...data }));
  }, [accounts]);

  // Net worth
  const netWorth = useMemo(() => accounts.reduce((s, a) => s + Number(a.balance), 0), [accounts]);

  // Savings progress
  const savingsProgress = useMemo(() => {
    const totalTarget = savingsGoals.reduce((s, g) => s + Number(g.target_amount), 0);
    const totalCurrent = savingsGoals.reduce((s, g) => s + Number(g.current_amount), 0);
    const completed = savingsGoals.filter(g => g.is_completed).length;
    return { totalTarget, totalCurrent, completed, total: savingsGoals.length, percentage: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0 };
  }, [savingsGoals]);

  // 7/30/90 day trends
  const multiTrends = useMemo(() => {
    const now = new Date();
    const calc = (days: number) => {
      const start = startOfDay(subDays(now, days));
      const txns = transactions.filter(t => {
        const d = parseISO(t.date);
        return isWithinInterval(d, { start, end: now });
      });
      const m = calcMetrics(txns);
      // Calculate previous period of same length
      const prevStart = startOfDay(subDays(now, days * 2));
      const prevEnd = startOfDay(subDays(now, days));
      const prevTxns = transactions.filter(t => {
        const d = parseISO(t.date);
        return isWithinInterval(d, { start: prevStart, end: prevEnd });
      });
      const pm = calcMetrics(prevTxns);
      return { ...m, expenseChange: pctChange(m.expense, pm.expense), incomeChange: pctChange(m.income, pm.income) };
    };
    return { d7: calc(7), d30: calc(30), d90: calc(90) };
  }, [transactions]);

  // Financial Health Score (0-100) — uses same logic as dashboard, driven by settings weights
  const healthScore = useMemo(() => {
    let score = 0;
    // Savings rate (max 30 pts default)
    score += Math.min(30, current.savingsRate * 1.5);
    // Expense control (max 20 pts)
    if (changes.expense <= 0) score += 20;
    else if (changes.expense < 10) score += 15;
    else if (changes.expense < 25) score += 10;
    else score += 5;
    // Income stability (max 20 pts)
    if (changes.income >= 0) score += 20;
    else if (changes.income > -10) score += 15;
    else score += 5;
    // Emergency fund (max 15 pts)
    const monthlyExpense = multiTrends.d30.expense;
    const emergencyMonths = monthlyExpense > 0 ? netWorth / monthlyExpense : 0;
    score += Math.min(15, emergencyMonths * 5);
    // Has budgets & goals (max 15 pts)
    if (budgets.length > 0) score += 7;
    if (savingsGoals.length > 0) score += 8;
    return Math.min(100, Math.round(score));
  }, [current, changes, multiTrends, netWorth, budgets, savingsGoals]);

  // Forecasting
  const forecast = useMemo(() => {
    const avgDailyExpense = multiTrends.d30.expense / 30;
    const avgDailyIncome = multiTrends.d30.income / 30;
    const daysInMonth = 30;
    const projectedExpense = avgDailyExpense * daysInMonth;
    const projectedIncome = avgDailyIncome * daysInMonth;
    const projectedSavings = projectedIncome - projectedExpense;
    // Budget overrun risks
    const atRiskBudgets = budgetPerformance.filter(b => b.percentage > 70 && !b.isOver).map(b => b.name);
    const overBudgets = budgetPerformance.filter(b => b.isOver).map(b => b.name);
    // Savings projection (12 months at current rate)
    const monthlySavings = multiTrends.d30.net;
    const yearProjection = netWorth + (monthlySavings * 12);
    return { projectedExpense, projectedIncome, projectedSavings, atRiskBudgets, overBudgets, yearProjection, monthlySavings };
  }, [multiTrends, budgetPerformance, netWorth]);

  // Spending spike detection
  const spendingSpike = useMemo(() => {
    if (period !== 'daily') return null;
    const todayExpense = current.expense;
    const avg7DayExpense = multiTrends.d7.expense / 7;
    if (avg7DayExpense > 0 && todayExpense > avg7DayExpense * 1.3) {
      return { pctAbove: Math.round(((todayExpense - avg7DayExpense) / avg7DayExpense) * 100) };
    }
    return null;
  }, [current, multiTrends, period]);

  // Action items
  const actionItems = useMemo(() => {
    const items: string[] = [];
    // Over-budget categories
    budgetPerformance.filter(b => b.isOver).forEach(b => {
      items.push(`Reduce ${b.category} spending by ${formatAmount(b.spent - b.budgeted)} — currently over budget`);
    });
    // Low savings rate
    if (current.savingsRate < 10 && current.income > 0) {
      items.push(`Increase savings rate from ${current.savingsRate.toFixed(0)}% to at least 20%`);
    }
    // Emergency fund low
    const monthlyExp = multiTrends.d30.expense;
    const emergencyMonths = monthlyExp > 0 ? netWorth / monthlyExp : 0;
    if (emergencyMonths < 3) {
      items.push(`Build emergency fund to cover ${Math.max(0, 3 - emergencyMonths).toFixed(1)} more months of expenses`);
    }
    // At-risk budgets
    forecast.atRiskBudgets.forEach(name => {
      items.push(`Watch ${name} budget — approaching limit`);
    });
    // Idle cash
    const cashAccounts = accounts.filter(a => a.type === 'cash' || a.type === 'mobile_money');
    const cashBalance = cashAccounts.reduce((s, a) => s + Number(a.balance), 0);
    if (cashBalance > netWorth * 0.5 && netWorth > 0) {
      items.push(`Consider moving idle cash/mobile money to a savings or investment account`);
    }
    if (items.length === 0) items.push('Your finances are on track! Keep up the good habits.');
    return items.slice(0, 5);
  }, [budgetPerformance, current, multiTrends, netWorth, forecast, accounts]);

  // Financial trajectory (annual)
  const trajectory = useMemo(() => {
    if (multiTrends.d90.net > 0 && changes.income >= 0) return 'Improving';
    if (multiTrends.d90.net < 0 && changes.expense > 10) return 'Declining';
    return 'Stable';
  }, [multiTrends, changes]);

  // Top expenses
  const topExpenses = useMemo(() =>
    currentTxns.filter(t => t.type === 'expense')
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 10),
    [currentTxns]
  );

  // Fixed vs variable (simplified: recurring = fixed)
  const fixedVsVariable = useMemo(() => {
    const expenses = currentTxns.filter(t => t.type === 'expense');
    const fixed = expenses.filter(t => t.is_recurring).reduce((s, t) => s + Number(t.amount), 0);
    const variable = expenses.filter(t => !t.is_recurring).reduce((s, t) => s + Number(t.amount), 0);
    return { fixed, variable, total: fixed + variable };
  }, [currentTxns]);

  return {
    ranges, current, previous, changes, categoryBreakdown, trendData,
    budgetPerformance, accountBreakdown, netWorth, savingsProgress,
    multiTrends, healthScore, forecast, spendingSpike, actionItems,
    trajectory, topExpenses, fixedVsVariable, currentTxns, previousTxns,
  };
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(amount));
}
