import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  score: number;
  trajectory: string;
  multiTrends: {
    d7: { expense: number; income: number; expenseChange: number; incomeChange: number };
    d30: { expense: number; income: number; expenseChange: number; incomeChange: number };
    d90: { expense: number; income: number; expenseChange: number; incomeChange: number };
  };
}

function TrendBadge({ label, change }: { label: string; change: number }) {
  const color = change <= 0 ? 'text-income bg-income/10' : change < 15 ? 'text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10' : 'text-expense bg-expense/10';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground font-medium">{label}</span>
      <motion.span
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        className={`font-mono font-semibold px-2.5 py-0.5 rounded-lg ${color}`}
      >
        {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
      </motion.span>
    </div>
  );
}

export default function HealthScoreCard({ score, trajectory, multiTrends }: Props) {
  const color = score >= 70 ? 'text-income' : score >= 40 ? 'text-[hsl(var(--warning))]' : 'text-expense';
  const strokeColor = score >= 70 ? 'hsl(var(--income))' : score >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--expense))';
  const trajectoryColor = trajectory === 'Improving' ? 'text-income bg-income/10' : trajectory === 'Declining' ? 'text-expense bg-expense/10' : 'text-muted-foreground bg-muted';
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <Card className="h-full overflow-hidden relative group">
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: strokeColor.replace(')', ' / 0.1)').replace('hsl(', 'hsl(') }}
      />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-primary" />
          </div>
          Financial Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-22 h-22 shrink-0" style={{ width: 88, height: 88 }}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
              <motion.circle
                cx="44" cy="44" r={r} fill="none"
                stroke={strokeColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className={`text-2xl font-black ${color}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 400, damping: 20 }}
              >
                {score}
              </motion.span>
              <span className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">/ 100</span>
            </div>
          </div>
          <div className="space-y-2.5">
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${trajectoryColor}`}
            >
              {trajectory}
            </motion.span>
            <p className="text-[10px] text-muted-foreground leading-relaxed">Based on savings, expenses, income stability & goals</p>
          </div>
        </div>
        <div className="space-y-2.5 border-t border-border/50 pt-3">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Expense Trends</p>
          <TrendBadge label="7 days" change={multiTrends.d7.expenseChange} />
          <TrendBadge label="30 days" change={multiTrends.d30.expenseChange} />
          <TrendBadge label="90 days" change={multiTrends.d90.expenseChange} />
        </div>
      </CardContent>
    </Card>
  );
}
