import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { Target } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BudgetPerf } from '../hooks/useReportData';

interface Props { data: BudgetPerf[]; }

export default function BudgetAnalysis({ data }: Props) {
  if (data.length === 0) return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-3 h-3 text-primary" />
          </div>
          Budget Performance
        </CardTitle>
      </CardHeader>
      <CardContent><div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">No budgets configured</div></CardContent>
    </Card>
  );

  const discipline = Math.round(data.filter(b => !b.isOver).length / data.length * 100);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-3 h-3 text-primary" />
            </div>
            Budget Performance
          </CardTitle>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
            discipline >= 80 ? 'bg-income/10 text-income' : discipline >= 50 ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' : 'bg-expense/10 text-expense'
          }`}>
            {discipline}% Discipline
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((b, i) => {
          const barColor = b.isOver ? 'bg-expense' : b.percentage > 80 ? 'bg-[hsl(var(--warning))]' : 'bg-income';
          return (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{b.name} <span className="text-muted-foreground">({b.period})</span></span>
                <span className={b.isOver ? 'text-expense font-semibold' : 'text-muted-foreground'}>
                  {formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(b.percentage, 100)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{b.percentage.toFixed(0)}% used</span>
                <span className={b.remaining < 0 ? 'text-expense font-medium' : ''}>
                  {b.remaining >= 0 ? `${formatCurrency(b.remaining)} left` : `${formatCurrency(Math.abs(b.remaining))} over`}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
