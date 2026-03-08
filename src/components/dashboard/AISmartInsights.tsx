import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Target, PiggyBank } from 'lucide-react';
import type { Account, Transaction, Category, Budget, SavingsGoal } from '@/types/finance';

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
}

export default function AISmartInsights({ accounts, transactions, categories, budgets, savingsGoals }: AISmartInsightsProps) {
  const insights = useMemo(() => {
    const result: Insight[] = [];
    const now = new Date();

    // Current month transactions
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const thisMonth = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd);

    // Previous month
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const lastMonth = transactions.filter(t => t.date >= prevStart && t.date <= prevEnd);

    const thisIncome = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const thisExpenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const lastIncome = lastMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const lastExpenses = lastMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    // 1. Spending comparison
    if (lastExpenses > 0 && thisExpenses > 0) {
      const changePct = ((thisExpenses - lastExpenses) / lastExpenses) * 100;
      if (changePct > 15) {
        result.push({
          icon: TrendingUp,
          title: 'Spending Increase',
          message: `You've spent ${Math.round(changePct)}% more this month compared to last month. Review your top categories.`,
          type: 'warning',
        });
      } else if (changePct < -10) {
        result.push({
          icon: TrendingDown,
          title: 'Spending Decreased',
          message: `Great job! Your spending dropped by ${Math.abs(Math.round(changePct))}% compared to last month.`,
          type: 'positive',
        });
      }
    }

    // 2. Savings rate
    if (thisIncome > 0) {
      const savingsRate = ((thisIncome - thisExpenses) / thisIncome) * 100;
      if (savingsRate >= 20) {
        result.push({
          icon: PiggyBank,
          title: 'Strong Savings Rate',
          message: `Your savings rate is ${Math.round(savingsRate)}%. You're on track for financial growth.`,
          type: 'positive',
        });
      } else if (savingsRate < 5 && savingsRate >= 0) {
        result.push({
          icon: AlertTriangle,
          title: 'Low Savings Rate',
          message: `Your savings rate is only ${Math.round(savingsRate)}%. Try to save at least 10-20% of income.`,
          type: 'warning',
        });
      }
    }

    // 3. Top spending category change
    const thisCatSpending: Record<string, number> = {};
    const lastCatSpending: Record<string, number> = {};
    thisMonth.filter(t => t.type === 'expense').forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)?.name || 'Other';
      thisCatSpending[cat] = (thisCatSpending[cat] || 0) + Number(t.amount);
    });
    lastMonth.filter(t => t.type === 'expense').forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)?.name || 'Other';
      lastCatSpending[cat] = (lastCatSpending[cat] || 0) + Number(t.amount);
    });

    // Find biggest increase
    let biggestIncrease = { cat: '', pct: 0 };
    for (const [cat, amt] of Object.entries(thisCatSpending)) {
      const prev = lastCatSpending[cat] || 0;
      if (prev > 0) {
        const pct = ((amt - prev) / prev) * 100;
        if (pct > biggestIncrease.pct && pct > 20) {
          biggestIncrease = { cat, pct };
        }
      }
    }
    if (biggestIncrease.cat) {
      result.push({
        icon: TrendingUp,
        title: `${biggestIncrease.cat} Spike`,
        message: `Your ${biggestIncrease.cat.toLowerCase()} spending increased by ${Math.round(biggestIncrease.pct)}% vs last month.`,
        type: 'warning',
      });
    }

    // 4. Budget warnings
    const nearBudget = budgets.filter(b => {
      const spent = thisMonth.filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true)).reduce((s, t) => s + Number(t.amount), 0);
      const pct = (spent / Number(b.amount)) * 100;
      return pct >= 80 && pct <= 100;
    });
    if (nearBudget.length > 0) {
      result.push({
        icon: AlertTriangle,
        title: 'Budget Alert',
        message: `${nearBudget.map(b => b.name).join(', ')} ${nearBudget.length === 1 ? 'is' : 'are'} nearing the limit (80%+).`,
        type: 'warning',
      });
    }

    // 5. Goals progress
    const nearComplete = savingsGoals.filter(g => {
      const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
      return pct >= 75 && !g.is_completed;
    });
    if (nearComplete.length > 0) {
      result.push({
        icon: Target,
        title: 'Goal Almost Reached',
        message: `${nearComplete.map(g => g.name).join(', ')} ${nearComplete.length === 1 ? 'is' : 'are'} 75%+ complete. Keep it up!`,
        type: 'positive',
      });
    }

    // Default insight
    if (result.length === 0) {
      result.push({
        icon: Sparkles,
        title: 'Getting Started',
        message: 'Add more transactions to unlock personalized financial insights.',
        type: 'neutral',
      });
    }

    return result.slice(0, 4);
  }, [accounts, transactions, categories, budgets, savingsGoals]);

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
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-3 h-3 text-primary" />
          </div>
          Smart Insights
          <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">AI-Powered</span>
        </CardTitle>
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
