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
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-primary" />
          </div>
          Budget Performance
        </CardTitle>
      </CardHeader>
      <CardContent><div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">No budgets configured</div></CardContent>
    </Card>
  );

  const discipline = Math.round(data.filter(b => !b.isOver).length / data.length * 100);
  const disciplineColor = discipline >= 80 ? 'bg-income/10 text-income' : discipline >= 50 ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' : 'bg-expense/10 text-expense';

  return (
    <Card className="h-full overflow-hidden relative group">
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-primary" />
            </div>
            Budget Performance
          </CardTitle>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${disciplineColor}`}
          >
            {discipline}% Discipline
          </motion.span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3.5">
        {data.map((b, i) => {
          const barColor = b.isOver ? 'bg-expense' : b.percentage > 80 ? 'bg-[hsl(var(--warning))]' : 'bg-income';
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-1.5 group/item"
            >
              <div className="flex justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  {b.name}
                  <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">{b.period}</span>
                </span>
                <span className={b.isOver ? 'text-expense font-bold' : 'text-muted-foreground font-mono text-[11px]'}>
                  {formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(b.percentage, 100)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="font-mono">{b.percentage.toFixed(0)}% used</span>
                <span className={b.remaining < 0 ? 'text-expense font-semibold' : 'font-mono'}>
                  {b.remaining >= 0 ? `${formatCurrency(b.remaining)} left` : `${formatCurrency(Math.abs(b.remaining))} over`}
                </span>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
