import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, Clock, Zap, DollarSign, AlertTriangle, Repeat, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { todayInTz, addDaysToKey } from '@/lib/datetime';
import type { Transaction, Category, Budget } from '@/types/finance';

const EXCLUDED_TAGS = new Set(['loan-disbursement', 'loan-repayment', 'bill-payment', 'transfer']);
const isDiscretionary = (t: Transaction) => !(t.tags || []).some(tg => EXCLUDED_TAGS.has(tg));

interface SmartSpendingDetectionProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}

interface Pattern {
  icon: typeof TrendingUp;
  title: string;
  message: string;
  type: 'insight' | 'suggestion' | 'automation' | 'anomaly';
  priority: number;
}

export default function SmartSpendingDetection({ transactions, categories, budgets }: SmartSpendingDetectionProps) {
  const patterns = useMemo(() => {
    const result: Pattern[] = [];
    const today = todayInTz();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Last 60 & 90 days of expenses (tz-aware) — exclude debt/bill/transfer noise
    const sixtyStr = addDaysToKey(today, -60);
    const ninetyStr = addDaysToKey(today, -90);
    const recentExpenses = transactions.filter(t => t.type === 'expense' && t.date >= sixtyStr && isDiscretionary(t));

    if (recentExpenses.length < 5) {
      result.push({ icon: Brain, title: 'Building Your Profile', message: 'Add more transactions to unlock smart spending detection and personalized patterns.', type: 'insight', priority: 0 });
      return result;
    }

    // ──── 1. ANOMALY DETECTION: Irregular/unusual transactions ────
    const catAvg: Record<string, { total: number; count: number; amounts: number[] }> = {};
    recentExpenses.forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)?.name || 'Other';
      if (!catAvg[cat]) catAvg[cat] = { total: 0, count: 0, amounts: [] };
      catAvg[cat].total += Number(t.amount);
      catAvg[cat].count++;
      catAvg[cat].amounts.push(Number(t.amount));
    });

    // Find transactions that are 3x the average for their category (tz-aware, discretionary only)
    const sevenStr = addDaysToKey(today, -7);
    const last7 = transactions.filter(t => t.type === 'expense' && t.date >= sevenStr && isDiscretionary(t));
    for (const t of last7) {
      const cat = categories.find(c => c.id === t.category_id)?.name || 'Other';
      const stats = catAvg[cat];
      if (stats && stats.count >= 3) {
        const avg = stats.total / stats.count;
        if (Number(t.amount) > avg * 3 && Number(t.amount) > 1000) {
          result.push({
            icon: ShieldAlert,
            title: 'Unusual Transaction Detected',
            message: `${formatCurrency(Number(t.amount))} for "${t.description || cat}" is ${Math.round(Number(t.amount) / avg)}x your average ${cat.toLowerCase()} spending.`,
            type: 'anomaly',
            priority: 10,
          });
          break;
        }
      }
    }

    // ──── 2. SUBSCRIPTION INCREASE DETECTION ────
    const descAmounts: Record<string, { amounts: number[]; dates: string[] }> = {};
    const ninetyExpenses = transactions.filter(t => t.type === 'expense' && t.date >= ninetyStr && isDiscretionary(t));
    ninetyExpenses.forEach(t => {
      const key = (t.description || '').toLowerCase().trim();
      if (key.length > 2) {
        if (!descAmounts[key]) descAmounts[key] = { amounts: [], dates: [] };
        descAmounts[key].amounts.push(Number(t.amount));
        descAmounts[key].dates.push(t.date);
      }
    });

    for (const [desc, data] of Object.entries(descAmounts)) {
      if (data.amounts.length >= 2) {
        // Sort by date to get chronological order
        const sorted = data.dates.map((d, i) => ({ date: d, amount: data.amounts[i] })).sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1].amount;
        const previous = sorted[sorted.length - 2].amount;
        if (latest > previous && previous > 0) {
          const increasePct = ((latest - previous) / previous) * 100;
          if (increasePct >= 10 && latest - previous > 100) {
            result.push({
              icon: TrendingUp,
              title: 'Subscription Price Increase',
              message: `"${desc}" increased by ${Math.round(increasePct)}% (${formatCurrency(previous)} → ${formatCurrency(latest)}). Review this recurring charge.`,
              type: 'anomaly',
              priority: 8,
            });
            break;
          }
        }
      }
    }

    // ──── 3. OVERSPENDING TREND (Week-over-week, tz-aware, discretionary only) ────
    const thisWeekStr = addDaysToKey(today, -7);
    const lastWeekStr = addDaysToKey(today, -14);

    const thisWeekSpend = transactions.filter(t => t.type === 'expense' && t.date >= thisWeekStr && isDiscretionary(t)).reduce((s, t) => s + Number(t.amount), 0);
    const lastWeekSpend = transactions.filter(t => t.type === 'expense' && t.date >= lastWeekStr && t.date < thisWeekStr && isDiscretionary(t)).reduce((s, t) => s + Number(t.amount), 0);

    if (lastWeekSpend > 0 && thisWeekSpend > lastWeekSpend * 1.3) {
      const pct = Math.round(((thisWeekSpend - lastWeekSpend) / lastWeekSpend) * 100);
      result.push({
        icon: AlertTriangle,
        title: 'Spending Trend Alert',
        message: `This week's spending is ${pct}% higher than last week (${formatCurrency(thisWeekSpend)} vs ${formatCurrency(lastWeekSpend)}). Consider slowing down.`,
        type: 'anomaly',
        priority: 7,
      });
    }

    // ──── 4. DAY-OF-WEEK PATTERN ────
    const catDaySpend: Record<string, number[]> = {};
    recentExpenses.forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)?.name || 'Other';
      if (!catDaySpend[cat]) catDaySpend[cat] = Array(7).fill(0);
      // tz-safe day-of-week via UTC noon anchor on the date key
      const dow = new Date(`${t.date}T12:00:00Z`).getUTCDay();
      catDaySpend[cat][dow] += Number(t.amount);
    });

    for (const [cat, days] of Object.entries(catDaySpend)) {
      const max = Math.max(...days);
      const avg = days.reduce((s, d) => s + d, 0) / 7;
      if (max > avg * 2 && max > 0) {
        const peakDay = dayNames[days.indexOf(max)];
        result.push({ icon: Clock, title: `${cat} Pattern Detected`, message: `You spend most on ${cat.toLowerCase()} on ${peakDay}s. Consider planning ahead to optimize.`, type: 'insight', priority: 3 });
        break;
      }
    }

    // ──── 5. BUDGET SUGGESTION for uncovered categories ────
    const topCats = Object.entries(catDaySpend)
      .map(([cat, days]) => ({ cat, total: days.reduce((s, d) => s + d, 0) }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
    const budgetedCatIds = budgets.map(b => b.category_id).filter(Boolean);
    const unbudgeted = topCats.filter(c => {
      const catObj = categories.find(cat => cat.name === c.cat);
      return catObj && !budgetedCatIds.includes(catObj.id);
    });
    if (unbudgeted.length > 0) {
      const top = unbudgeted[0];
      const monthlyEstimate = (top.total / 60) * 30;
      result.push({ icon: DollarSign, title: 'Budget Suggestion', message: `Consider budgeting ${formatCurrency(Math.ceil(monthlyEstimate / 1000) * 1000)}/month for "${top.cat}" based on your spending history.`, type: 'suggestion', priority: 4 });
    }

    // ──── 6. RECURRING TRANSACTION DETECTION ────
    const descFrequency: Record<string, number> = {};
    recentExpenses.forEach(t => {
      const key = (t.description || '').toLowerCase().trim();
      if (key.length > 2) descFrequency[key] = (descFrequency[key] || 0) + 1;
    });
    const recurring = Object.entries(descFrequency).filter(([_, count]) => count >= 3).sort((a, b) => b[1] - a[1]);
    if (recurring.length > 0) {
      result.push({ icon: Repeat, title: 'Recurring Expense Detected', message: `"${recurring[0][0]}" appears ${recurring[0][1]} times in 60 days. Consider adding it as a recurring bill.`, type: 'automation', priority: 5 });
    }

    // ──── 7. SAVINGS OPPORTUNITY (tz-aware, discretionary only) ────
    const thirtyStr = addDaysToKey(today, -30);
    const last30Income = transactions
      .filter(t => t.type === 'income' && t.date >= thirtyStr && isDiscretionary(t))
      .reduce((s, t) => s + Number(t.amount), 0);
    const last30Expense = recentExpenses
      .filter(t => t.date >= thirtyStr)
      .reduce((s, t) => s + Number(t.amount), 0);

    if (last30Income > 0) {
      const surplus = last30Income - last30Expense;
      if (surplus > 0) {
        const suggestedSave = Math.round(surplus * 0.2);
        result.push({ icon: Zap, title: 'Smart Savings Opportunity', message: `You had ${formatCurrency(surplus)} surplus last month. Auto-save ${formatCurrency(suggestedSave)} (20%) to accelerate your goals.`, type: 'automation', priority: 2 });
      }
    }

    // Sort by priority (highest first) and return top 5
    return result.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [transactions, categories, budgets]);

  const typeStyles: Record<string, { bg: string; badge: string }> = {
    insight: { bg: 'bg-primary/5 border-primary/15', badge: 'bg-primary/10 text-primary' },
    suggestion: { bg: 'bg-income/5 border-income/15', badge: 'bg-income/10 text-income' },
    automation: { bg: 'bg-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/15', badge: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' },
    anomaly: { bg: 'bg-destructive/5 border-destructive/15', badge: 'bg-destructive/10 text-destructive' },
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
                  <Icon className={`w-3.5 h-3.5 ${p.type === 'anomaly' ? 'text-destructive' : 'text-primary'}`} />
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
