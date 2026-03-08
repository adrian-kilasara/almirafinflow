import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { PiggyBank } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SavingsGoal } from '@/types/finance';

interface Props {
  savingsGoals: SavingsGoal[];
  savingsProgress: { totalTarget: number; totalCurrent: number; completed: number; total: number; percentage: number; };
  netWorth: number;
}

export default function SavingsAndGoals({ savingsGoals, savingsProgress, netWorth }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <PiggyBank className="w-3 h-3 text-primary" />
          </div>
          Savings & Goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Net Worth', value: formatCurrency(netWorth), color: '' },
            { label: 'Saved', value: formatCurrency(savingsProgress.totalCurrent), color: 'text-income' },
            { label: 'Done', value: `${savingsProgress.completed}/${savingsProgress.total}`, color: 'text-primary' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="p-2 rounded-xl bg-muted/30"
            >
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</p>
            </motion.div>
          ))}
        </div>
        {savingsGoals.length > 0 ? (
          <div className="space-y-2.5">
            {savingsGoals.slice(0, 4).map((g, i) => {
              const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
              return (
                <div key={g.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>{g.icon || '🎯'}</span>
                      {g.name}
                    </span>
                    <span className="font-mono text-[10px]">{formatCurrency(Number(g.current_amount))} / {formatCurrency(Number(g.target_amount))}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">No savings goals yet</p>
        )}
      </CardContent>
    </Card>
  );
}
