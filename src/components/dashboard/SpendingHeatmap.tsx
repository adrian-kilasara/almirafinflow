import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Flame, Clock, ShoppingBag, Zap } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Transaction, Category } from '@/types/finance';

interface SpendingHeatmapProps {
  transactions: Transaction[];
  categories?: Category[];
}

export default function SpendingHeatmap({ transactions, categories = [] }: SpendingHeatmapProps) {
  const heatmapData = useMemo(() => {
    const now = new Date();
    const weeks = 12;
    const days: { date: string; amount: number; day: number; week: number }[] = [];

    for (let i = weeks * 7 - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const amount = transactions.filter(t => t.type === 'expense' && t.date === dateStr).reduce((s, t) => s + Number(t.amount), 0);
      days.push({ date: dateStr, amount, day: d.getDay(), week: Math.floor((weeks * 7 - 1 - i) / 7) });
    }
    return days;
  }, [transactions]);

  // Behavior analysis
  const behaviorInsights = useMemo(() => {
    const now = new Date();
    const thirtyAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const recentExpenses = transactions.filter(t => t.type === 'expense' && t.date >= thirtyAgo);
    const insights: { icon: typeof Clock; label: string; value: string; color: string }[] = [];

    if (recentExpenses.length < 3) return insights;

    // Weekend vs Weekday
    const weekendTxns = recentExpenses.filter(t => { const d = new Date(t.date).getDay(); return d === 0 || d === 6; });
    const weekdayTxns = recentExpenses.filter(t => { const d = new Date(t.date).getDay(); return d >= 1 && d <= 5; });
    const weekendAvg = weekendTxns.length > 0 ? weekendTxns.reduce((s, t) => s + Number(t.amount), 0) / weekendTxns.length : 0;
    const weekdayAvg = weekdayTxns.length > 0 ? weekdayTxns.reduce((s, t) => s + Number(t.amount), 0) / weekdayTxns.length : 0;
    const spendType = weekendAvg > weekdayAvg * 1.5 ? 'Weekend Spender' : weekdayAvg > weekendAvg * 1.5 ? 'Weekday Spender' : 'Even Spender';
    insights.push({ icon: Clock, label: 'Pattern', value: spendType, color: 'text-primary' });

    // Category velocity: fastest growing category
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0];
    const firstHalf = recentExpenses.filter(t => t.date < twoWeeksAgo);
    const secondHalf = recentExpenses.filter(t => t.date >= twoWeeksAgo);
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const catFirst: Record<string, number> = {};
      const catSecond: Record<string, number> = {};
      firstHalf.forEach(t => { const c = categories.find(x => x.id === t.category_id)?.name || 'Other'; catFirst[c] = (catFirst[c] || 0) + Number(t.amount); });
      secondHalf.forEach(t => { const c = categories.find(x => x.id === t.category_id)?.name || 'Other'; catSecond[c] = (catSecond[c] || 0) + Number(t.amount); });
      let fastestCat = '', fastestGrowth = 0;
      for (const [cat, amt] of Object.entries(catSecond)) {
        const prev = catFirst[cat] || 0;
        if (prev > 0) {
          const growth = ((amt - prev) / prev) * 100;
          if (growth > fastestGrowth) { fastestCat = cat; fastestGrowth = growth; }
        }
      }
      if (fastestCat && fastestGrowth > 20) {
        insights.push({ icon: Zap, label: 'Trending', value: `${fastestCat} ↑${Math.round(fastestGrowth)}%`, color: 'text-[hsl(var(--warning))]' });
      }
    }

    // Impulse detection: small frequent transactions
    const smallTxns = recentExpenses.filter(t => Number(t.amount) < 500);
    const smallTotal = smallTxns.reduce((s, t) => s + Number(t.amount), 0);
    const totalSpend = recentExpenses.reduce((s, t) => s + Number(t.amount), 0);
    if (totalSpend > 0 && smallTxns.length >= 10 && (smallTotal / totalSpend) > 0.3) {
      insights.push({ icon: ShoppingBag, label: 'Impulse', value: `${smallTxns.length} small buys`, color: 'text-expense' });
    }

    return insights;
  }, [transactions, categories]);

  const maxAmount = Math.max(...heatmapData.map(d => d.amount), 1);
  const getIntensity = (amount: number) => {
    if (amount === 0) return 'bg-muted/20';
    const ratio = amount / maxAmount;
    if (ratio < 0.25) return 'bg-primary/20';
    if (ratio < 0.5) return 'bg-primary/40';
    if (ratio < 0.75) return 'bg-primary/60';
    return 'bg-primary/90';
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totalSpent = heatmapData.reduce((s, d) => s + d.amount, 0);
  const avgDaily = totalSpent / (12 * 7);

  const dayOfWeekSpend = useMemo(() => {
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    heatmapData.forEach(d => { sums[d.day] += d.amount; counts[d.day]++; });
    return sums.map((s, i) => ({ day: dayLabels[i], avg: counts[i] > 0 ? s / counts[i] : 0 }));
  }, [heatmapData]);
  const peakDay = dayOfWeekSpend.reduce((a, b) => a.avg > b.avg ? a : b);

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Flame className="w-3 h-3 text-primary" />
            </div>
            Spending Behavior
            <span className="text-[9px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full font-normal">12 weeks</span>
          </CardTitle>
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground">Peak Day</p>
            <p className="text-xs font-bold text-primary">{peakDay.day}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Behavior Insights */}
        {behaviorInsights.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {behaviorInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/30"
              >
                <insight.icon className={`w-3 h-3 ${insight.color}`} />
                <span className="text-[9px] text-muted-foreground">{insight.label}:</span>
                <span className={`text-[9px] font-bold ${insight.color}`}>{insight.value}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total (12w)', value: formatCurrency(totalSpent) },
            { label: 'Avg/Day', value: formatCurrency(avgDaily) },
            { label: 'Peak', value: formatCurrency(peakDay.avg) + '/day' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-2 rounded-lg bg-muted/20 text-center">
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
              <p className="text-[11px] font-bold font-mono">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Heatmap Grid */}
        <div className="flex gap-1">
          <div className="flex flex-col gap-[3px] mr-1 pt-0">
            {dayLabels.map((d, i) => (
              <span key={d} className="text-[8px] text-muted-foreground h-[14px] flex items-center">{i % 2 === 1 ? d.charAt(0) : ''}</span>
            ))}
          </div>
          <div className="flex gap-[3px] flex-1 overflow-hidden">
            {Array.from({ length: 12 }, (_, week) => (
              <div key={week} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, day) => {
                  const cell = heatmapData.find(d => d.week === week && d.day === day);
                  return (
                    <motion.div
                      key={`${week}-${day}`}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (week * 7 + day) * 0.003 }}
                      className={`w-[14px] h-[14px] rounded-[3px] ${getIntensity(cell?.amount || 0)} transition-colors cursor-default`}
                      title={cell ? `${cell.date}: ${formatCurrency(cell.amount)}` : ''}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-[8px] text-muted-foreground">Less</span>
          {['bg-muted/20', 'bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary/90'].map((cls, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-[2px] ${cls}`} />
          ))}
          <span className="text-[8px] text-muted-foreground">More</span>
        </div>
      </CardContent>
    </Card>
  );
}
