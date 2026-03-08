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
    <Card className="h-full overflow-hidden relative group">
      <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
            <PiggyBank className="w-3.5 h-3.5 text-primary" />
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
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="p-2.5 rounded-xl bg-muted/30 border border-border/30"
            >
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">{item.label}</p>
              <p className={`text-sm font-black font-mono ${item.color}`}>{item.value}</p>
            </motion.div>
          ))}
        </div>
        {savingsGoals.length > 0 ? (
          <div className="space-y-2.5">
            {savingsGoals.slice(0, 4).map((g, i) => {
              const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="space-y-1.5"
                >
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>{g.icon || '🎯'}</span>
                      {g.name}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{formatCurrency(Number(g.current_amount))} / {formatCurrency(Number(g.target_amount))}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </motion.div>
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
