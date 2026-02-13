import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { PiggyBank } from 'lucide-react';
import type { SavingsGoal } from '@/types/finance';

interface Props {
  savingsGoals: SavingsGoal[];
  savingsProgress: { totalTarget: number; totalCurrent: number; completed: number; total: number; percentage: number; };
  netWorth: number;
}

export default function SavingsAndGoals({ savingsGoals, savingsProgress, netWorth }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><PiggyBank className="w-4 h-4 text-primary" /> Savings & Goals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Net Worth</p>
            <p className="text-sm font-bold font-mono">{formatCurrency(netWorth)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saved</p>
            <p className="text-sm font-bold font-mono text-income">{formatCurrency(savingsProgress.totalCurrent)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Goals Done</p>
            <p className="text-sm font-bold">{savingsProgress.completed}/{savingsProgress.total}</p>
          </div>
        </div>
        {savingsGoals.length > 0 ? (
          <div className="space-y-2">
            {savingsGoals.slice(0, 4).map(g => {
              const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
              return (
                <div key={g.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{g.name}</span>
                    <span className="font-mono">{formatCurrency(Number(g.current_amount))} / {formatCurrency(Number(g.target_amount))}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">No savings goals yet</p>
        )}
      </CardContent>
    </Card>
  );
}
