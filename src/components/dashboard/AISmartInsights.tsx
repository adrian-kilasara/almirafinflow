import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Target, PiggyBank, ShoppingBag, BarChart3, Wallet, RefreshCw } from 'lucide-react';
import type { Account, Transaction, Category, Budget, SavingsGoal } from '@/types/finance';
import { todayInTz, monthRangeInTz, addDaysToKey, nowDisplayInTz } from '@/lib/datetime';

interface AISmartInsightsProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
}

interface Insight {
  icon: typeof TrendingUp;
  title: string;
  message: string;
  type: 'positive' | 'warning' | 'neutral';
  priority: number;
}

// Tags that should NEVER trigger spending insights (debt servicing, scheduled bills, transfers)
const EXCLUDED_TAGS = new Set(['loan-disbursement', 'loan-repayment', 'bill-payment', 'transfer']);
const isDiscretionary = (t: Transaction) => !(t.tags || []).some(tg => EXCLUDED_TAGS.has(tg));

export default function AISmartInsights({ accounts, transactions, categories, budgets, savingsGoals }: AISmartInsightsProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshedAt = useMemo(() => nowDisplayInTz(), [refreshKey, transactions.length]);

  const insights = useMemo(() => {
    const result: Insight[] = [];
    const today = todayInTz();
    const { start: monthStart, end: monthEnd } = monthRangeInTz();

    // Previous month range (tz-aware)
    const [py, pm] = monthStart.split('-').map(Number);
    const prevMonthDate = new Date(Date.UTC(py, pm - 2, 1));
    const prevYear = prevMonthDate.getUTCFullYear();
    const prevMonth = prevMonthDate.getUTCMonth() + 1;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevLastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

    const thisMonth = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd && isDiscretionary(t));
    const lastMonth = transactions.filter(t => t.date >= prevStart && t.date <= prevEnd && isDiscretionary(t));

    const thisIncome = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const thisExpenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const lastExpenses = lastMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    const MIN_TXNS = 5;

    // 1. Spending comparison — only if both months have meaningful data
    if (lastMonth.length >= MIN_TXNS && thisMonth.length >= MIN_TXNS && lastExpenses > 0 && thisExpenses > 0) {
      const changePct = ((thisExpenses - lastExpenses) / lastExpenses) * 100;
      if (changePct > 15) {
        result.push({ icon: TrendingUp, title: 'Spending Increase', message: `You've spent ${Math.round(changePct)}% more this month compared to last month. Review your top categories.`, type: 'warning', priority: 8 });
      } else if (changePct < -10) {
        result.push({ icon: TrendingDown, title: 'Spending Decreased', message: `Great job! Your spending dropped by ${Math.abs(Math.round(changePct))}% compared to last month.`, type: 'positive', priority: 5 });
      }
    }

    // 2. Savings rate
    if (thisIncome > 0 && thisMonth.length >= MIN_TXNS) {
      const savingsRate = ((thisIncome - thisExpenses) / thisIncome) * 100;
      if (savingsRate >= 20) {
        result.push({ icon: PiggyBank, title: 'Strong Savings Rate', message: `Your savings rate is ${Math.round(savingsRate)}%. You're on track for financial growth.`, type: 'positive', priority: 4 });
      } else if (savingsRate < 5 && savingsRate >= 0) {
        result.push({ icon: AlertTriangle, title: 'Low Savings Rate', message: `Your savings rate is only ${Math.round(savingsRate)}%. Try to save at least 10-20% of income.`, type: 'warning', priority: 9 });
      }
    }

    // 3. Weekend vs Weekday spending — divide by CALENDAR DAYS, not transaction counts
    const thisMonthExpenses = thisMonth.filter(t => t.type === 'expense');
    if (thisMonthExpenses.length >= MIN_TXNS) {
      // Count calendar days from monthStart through today (or month end if past)
      const periodEnd = today < monthEnd ? today : monthEnd;
      let weekendCalDays = 0;
      let weekdayCalDays = 0;
      let cursor = monthStart;
      while (cursor <= periodEnd) {
        const dow = new Date(`${cursor}T12:00:00Z`).getUTCDay();
        if (dow === 0 || dow === 6) weekendCalDays++; else weekdayCalDays++;
        cursor = addDaysToKey(cursor, 1);
      }

      const weekendSpend = thisMonthExpenses.filter(t => { const d = new Date(`${t.date}T12:00:00Z`).getUTCDay(); return d === 0 || d === 6; }).reduce((s, t) => s + Number(t.amount), 0);
      const weekdaySpend = thisMonthExpenses.filter(t => { const d = new Date(`${t.date}T12:00:00Z`).getUTCDay(); return d >= 1 && d <= 5; }).reduce((s, t) => s + Number(t.amount), 0);

      if (weekendCalDays > 0 && weekdayCalDays > 0 && weekendSpend > 0 && weekdaySpend > 0) {
        const avgWeekend = weekendSpend / weekendCalDays;
        const avgWeekday = weekdaySpend / weekdayCalDays;
        if (avgWeekend > avgWeekday * 1.5) {
          result.push({
            icon: ShoppingBag,
            title: 'Weekend Spending Spike',
            message: `You spend ${Math.round((avgWeekend / avgWeekday - 1) * 100)}% more per day on weekends (${formatCurrency(avgWeekend)}/day) than weekdays (${formatCurrency(avgWeekday)}/day).`,
            type: 'warning',
            priority: 6,
          });
        }
      }
    }

    // 4. Merchant concentration
    const merchantSpend: Record<string, number> = {};
    thisMonthExpenses.forEach(t => {
      const key = (t as any).merchant || t.description || 'Unknown';
      merchantSpend[key] = (merchantSpend[key] || 0) + Number(t.amount);
    });
    const topMerchant = Object.entries(merchantSpend).sort((a, b) => b[1] - a[1])[0];
    if (topMerchant && thisExpenses > 0 && thisMonthExpenses.length >= MIN_TXNS && topMerchant[1] / thisExpenses > 0.4) {
      result.push({ icon: BarChart3, title: 'Merchant Concentration', message: `${Math.round((topMerchant[1] / thisExpenses) * 100)}% of your spending goes to "${topMerchant[0]}". Diversifying could reduce risk.`, type: 'warning', priority: 5 });
    }

    // 5. Spending pace (tz-aware day-of-month)
    const dayOfMonth = Number(today.split('-')[2]);
    const daysInMonth = Number(monthEnd.split('-')[2]);
    const monthProgress = dayOfMonth / daysInMonth;
    if (lastMonth.length >= MIN_TXNS && lastExpenses > 0 && monthProgress > 0.2 && thisMonthExpenses.length >= MIN_TXNS) {
      const projectedSpend = thisExpenses / monthProgress;
      if (projectedSpend > lastExpenses * 1.2) {
        result.push({ icon: AlertTriangle, title: 'Spending Pace Warning', message: `At current pace, you'll spend ${formatCurrency(Math.round(projectedSpend))} this month — ${Math.round(((projectedSpend / lastExpenses) - 1) * 100)}% more than last month.`, type: 'warning', priority: 7 });
      }
    }

    // 6. Income stability
    const lastIncome = lastMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    if (lastIncome > 0 && thisIncome > 0) {
      const incomeChange = ((thisIncome - lastIncome) / lastIncome) * 100;
      if (incomeChange < -20) {
        result.push({ icon: Wallet, title: 'Income Drop Detected', message: `Your income dropped ${Math.abs(Math.round(incomeChange))}% vs last month. Consider reviewing your income sources.`, type: 'warning', priority: 9 });
      } else if (incomeChange > 20) {
        result.push({ icon: TrendingUp, title: 'Income Growth', message: `Your income grew ${Math.round(incomeChange)}% vs last month. Great time to increase savings contributions.`, type: 'positive', priority: 3 });
      }
    }

    // 7. Top spending category spike
    const thisCatSpending: Record<string, number> = {};
    const lastCatSpending: Record<string, number> = {};
    thisMonthExpenses.forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)?.name || 'Other';
      thisCatSpending[cat] = (thisCatSpending[cat] || 0) + Number(t.amount);
    });
    lastMonth.filter(t => t.type === 'expense').forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)?.name || 'Other';
      lastCatSpending[cat] = (lastCatSpending[cat] || 0) + Number(t.amount);
    });
    let biggestIncrease = { cat: '', pct: 0 };
    for (const [cat, amt] of Object.entries(thisCatSpending)) {
      const prev = lastCatSpending[cat] || 0;
      if (prev > 1000) {
        const pct = ((amt - prev) / prev) * 100;
        if (pct > biggestIncrease.pct && pct > 20) biggestIncrease = { cat, pct };
      }
    }
    if (biggestIncrease.cat) {
      result.push({ icon: TrendingUp, title: `${biggestIncrease.cat} Spike`, message: `Your ${biggestIncrease.cat.toLowerCase()} spending increased by ${Math.round(biggestIncrease.pct)}% vs last month.`, type: 'warning', priority: 6 });
    }

    // 8. Budget warnings
    const nearBudget = budgets.filter(b => {
      const spent = thisMonth.filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true)).reduce((s, t) => s + Number(t.amount), 0);
      const pct = (spent / Number(b.amount)) * 100;
      return pct >= 80 && pct <= 100;
    });
    if (nearBudget.length > 0) {
      result.push({ icon: AlertTriangle, title: 'Budget Alert', message: `${nearBudget.map(b => b.name).join(', ')} ${nearBudget.length === 1 ? 'is' : 'are'} nearing the limit (80%+).`, type: 'warning', priority: 8 });
    }

    // 9. Goals near completion
    const nearComplete = savingsGoals.filter(g => {
      const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
      return pct >= 75 && !g.is_completed;
    });
    if (nearComplete.length > 0) {
      result.push({ icon: Target, title: 'Goal Almost Reached', message: `${nearComplete.map(g => g.name).join(', ')} ${nearComplete.length === 1 ? 'is' : 'are'} 75%+ complete. Keep it up!`, type: 'positive', priority: 4 });
    }

    if (result.length === 0) {
      result.push({ icon: Sparkles, title: 'Getting Started', message: 'Add at least 5 transactions this month to unlock personalized insights.', type: 'neutral', priority: 0 });
    }

    return result.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [accounts, transactions, categories, budgets, savingsGoals, refreshKey]);

  const getTypeStyles = (type: Insight['type']) => {
    switch (type) {
      case 'positive': return { bg: 'bg-income/5 border-income/15', icon: 'text-income' };
      case 'warning': return { bg: 'bg-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/15', icon: 'text-[hsl(var(--warning))]' };
      default: return { bg: 'bg-muted/30 border-border/30', icon: 'text-primary' };
    }
  };

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="w-3 h-3 text-primary" />
            </div>
            Smart Insights
            <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">AI-Powered</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRefreshKey(k => k + 1)}
            title="Refresh insights"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </CardTitle>
        <p className="text-[9px] text-muted-foreground pt-0.5">Updated {refreshedAt}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          const styles = getTypeStyles(insight.type);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`p-3 rounded-xl border ${styles.bg}`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`w-7 h-7 rounded-lg bg-background/50 flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`w-3.5 h-3.5 ${styles.icon}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold">{insight.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{insight.message}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
