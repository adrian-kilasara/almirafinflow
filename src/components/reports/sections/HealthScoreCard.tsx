import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

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
  const color = change <= 0 ? 'text-income' : change < 15 ? 'text-[hsl(var(--warning))]' : 'text-expense';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${color}`}>
        {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
      </span>
    </div>
  );
}

export default function HealthScoreCard({ score, trajectory, multiTrends }: Props) {
  const color = score >= 70 ? 'text-income' : score >= 40 ? 'text-[hsl(var(--warning))]' : 'text-expense';
  const bg = score >= 70 ? 'bg-income' : score >= 40 ? 'bg-[hsl(var(--warning))]' : 'bg-expense';
  const trajectoryColor = trajectory === 'Improving' ? 'text-income bg-income/10' : trajectory === 'Declining' ? 'text-expense bg-expense/10' : 'text-muted-foreground bg-muted';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Activity className="w-4 h-4 text-primary" /> Financial Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"
                className={color} strokeDasharray={`${score * 1.76} 176`} strokeLinecap="round" />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${color}`}>{score}</span>
          </div>
          <div className="space-y-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trajectoryColor}`}>{trajectory}</span>
            <p className="text-xs text-muted-foreground">Based on savings, expenses, income stability & emergency fund</p>
          </div>
        </div>
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Expense Trends</p>
          <TrendBadge label="7-day" change={multiTrends.d7.expenseChange} />
          <TrendBadge label="30-day" change={multiTrends.d30.expenseChange} />
          <TrendBadge label="90-day" change={multiTrends.d90.expenseChange} />
        </div>
      </CardContent>
    </Card>
  );
}
