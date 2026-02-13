import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { Target } from 'lucide-react';
import type { BudgetPerf } from '../hooks/useReportData';

interface Props { data: BudgetPerf[]; }

export default function BudgetAnalysis({ data }: Props) {
  if (data.length === 0) return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Target className="w-4 h-4 text-primary" /> Budget Performance</CardTitle>
      </CardHeader>
      <CardContent><div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">No budgets configured</div></CardContent>
    </Card>
  );

  const discipline = data.length > 0 ? Math.round(data.filter(b => !b.isOver).length / data.length * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Target className="w-4 h-4 text-primary" /> Budget Performance</CardTitle>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${discipline >= 80 ? 'bg-income/10 text-income' : discipline >= 50 ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' : 'bg-expense/10 text-expense'}`}>
            Discipline: {discipline}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((b, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">{b.name} <span className="text-muted-foreground">({b.period})</span></span>
              <span className={b.isOver ? 'text-expense font-semibold' : 'text-muted-foreground'}>
                {formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${b.isOver ? 'bg-expense' : b.percentage > 80 ? 'bg-[hsl(var(--warning))]' : 'bg-income'}`}
                style={{ width: `${Math.min(b.percentage, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{b.percentage.toFixed(0)}%</span>
              <span className={b.remaining < 0 ? 'text-expense' : ''}>{b.remaining >= 0 ? `${formatCurrency(b.remaining)} left` : `${formatCurrency(Math.abs(b.remaining))} over`}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
