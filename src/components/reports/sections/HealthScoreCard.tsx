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
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium px-2 py-0.5 rounded-md ${color}`}>
        {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
      </span>
    </div>
  );
}

export default function HealthScoreCard({ score, trajectory, multiTrends }: Props) {
  const color = score >= 70 ? 'text-income' : score >= 40 ? 'text-[hsl(var(--warning))]' : 'text-expense';
  const strokeColor = score >= 70 ? 'hsl(var(--income))' : score >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--expense))';
  const trajectoryColor = trajectory === 'Improving' ? 'text-income bg-income/10' : trajectory === 'Declining' ? 'text-expense bg-expense/10' : 'text-muted-foreground bg-muted';
  const circumference = 2 * Math.PI * 38;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-3 h-3 text-primary" />
          </div>
          Financial Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="38" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
              <motion.circle
                cx="42" cy="42" r="38" fill="none"
                stroke={strokeColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className={`text-xl font-bold ${color}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {score}
              </motion.span>
              <span className="text-[9px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className="space-y-2">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${trajectoryColor}`}>{trajectory}</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Based on savings, expenses, income stability & goals</p>
          </div>
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expense Trends</p>
          <TrendBadge label="7 days" change={multiTrends.d7.expenseChange} />
          <TrendBadge label="30 days" change={multiTrends.d30.expenseChange} />
          <TrendBadge label="90 days" change={multiTrends.d90.expenseChange} />
        </div>
      </CardContent>
    </Card>
  );
}
