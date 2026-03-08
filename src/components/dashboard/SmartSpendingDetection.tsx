import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, Clock, Zap, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Transaction, Category, Budget } from '@/types/finance';

interface SmartSpendingDetectionProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}

interface Pattern {
  icon: typeof TrendingUp;
  title: string;
  message: string;
  type: 'insight' | 'suggestion' | 'automation';
}

export default function SmartSpendingDetection({ transactions, categories, budgets }: SmartSpendingDetectionProps) {
  const patterns = useMemo(() => {
    const result: Pattern[] = [];
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Last 60 days of expenses
    const sixtyAgo = new Date(now);
    sixtyAgo.setDate(sixtyAgo.getDate() - 60);
    const sixtyStr = sixtyAgo.toISOString().split('T')[0];
    const recentExpenses = transactions.filter(t => t.type === 'expense' && t.date >= sixtyStr);

    if (recentExpenses.length < 5) {
      result.push({
        icon: Brain,
        title: 'Building Your Profile',
        message: 'Add more transactions to unlock smart spending detection and personalized patterns.',
        type: 'insight',
      });
      return result;
    }

    // 1. Day-of-week spending patterns per category
    const catDaySpend: Record<string, number[]> = {};
    recentExpenses.forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)?.name || 'Other';
      if (!catDaySpend[cat]) catDaySpend[cat] = Array(7).fill(0);
      catDaySpend[cat][new Date(t.date).getDay()] += Number(t.amount);
    });

    // Find top category with clearest day pattern
    for (const [cat, days] of Object.entries(catDaySpend)) {
      const max = Math.max(...days);
      const avg = days.reduce((s, d) => s + d, 0) / 7;
      if (max > avg * 2 && max > 0) {
        const peakDay = dayNames[days.indexOf(max)];
        result.push({
          icon: Clock,
          title: `${cat} Pattern Detected`,
          message: `You spend most on ${cat.toLowerCase()} on ${peakDay}s. Consider planning ahead to optimize.`,
          type: 'insight',
        });
      }
      if (result.length >= 1) break;
    }

    // 2. Budget suggestions for uncovered categories
    const topCats = Object.entries(catDaySpend)
      .map(([cat, days]) => ({ cat, total: days.reduce((s, d) => s + d, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const budgetedCatIds = budgets.map(b => b.category_id).filter(Boolean);
    const unbudgeted = topCats.filter(c => {
      const catObj = categories.find(cat => cat.name === c.cat);
      return catObj && !budgetedCatIds.includes(catObj.id);
    });

    if (unbudgeted.length > 0) {
      const top = unbudgeted[0];
      const monthlyEstimate = (top.total / 60) * 30;
      result.push({
        icon: DollarSign,
        title: 'Budget Suggestion',
        message: `Consider budgeting ${formatCurrency(Math.ceil(monthlyEstimate / 1000) * 1000)}/month for "${top.cat}" based on your spending history.`,
        type: 'suggestion',
      });
    }

    // 3. Recurring transaction detection
    const descFrequency: Record<string, number> = {};
    recentExpenses.forEach(t => {
      const key = (t.description || t.merchant || '').toLowerCase().trim();
      if (key.length > 2) descFrequency[key] = (descFrequency[key] || 0) + 1;
    });

    const recurring = Object.entries(descFrequency)
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);

    if (recurring.length > 0) {
      result.push({
        icon: Zap,
        title: 'Recurring Expense Detected',
        message: `"${recurring[0][0]}" appears ${recurring[0][1]} times in 60 days. Consider adding it as a recurring bill.`,
        type: 'automation',
      });
    }

    // 4. Savings automation hint
    const last30Income = transactions
      .filter(t => t.type === 'income' && t.date >= new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0])
      .reduce((s, t) => s + Number(t.amount), 0);
    const last30Expense = recentExpenses
      .filter(t => t.date >= new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0])
      .reduce((s, t) => s + Number(t.amount), 0);

    if (last30Income > 0) {
      const surplus = last30Income - last30Expense;
      if (surplus > 0) {
        const suggestedSave = Math.round(surplus * 0.2);
        result.push({
          icon: TrendingUp,
          title: 'Smart Savings Opportunity',
          message: `You had ${formatCurrency(surplus)} surplus last month. Auto-save ${formatCurrency(suggestedSave)} (20%) to accelerate your goals.`,
          type: 'automation',
        });
      }
    }

    return result.slice(0, 4);
  }, [transactions, categories, budgets]);

  const typeStyles = {
    insight: { bg: 'bg-primary/5 border-primary/15', badge: 'bg-primary/10 text-primary' },
    suggestion: { bg: 'bg-income/5 border-income/15', badge: 'bg-income/10 text-income' },
    automation: { bg: 'bg-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/15', badge: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' },
  };

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-3 h-3 text-primary" />
          </div>
          Smart Detection
          <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">AI-Powered</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {patterns.map((p, i) => {
          const Icon = p.icon;
          const styles = typeStyles[p.type];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`p-3 rounded-xl border ${styles.bg}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-background/50 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold">{p.title}</p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-semibold capitalize ${styles.badge}`}>{p.type}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{p.message}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
