import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { Zap, AlertTriangle } from 'lucide-react';

interface Props {
  forecast: {
    projectedExpense: number;
    projectedIncome: number;
    projectedSavings: number;
    atRiskBudgets: string[];
    overBudgets: string[];
    yearProjection: number;
    monthlySavings: number;
  };
  netWorth: number;
}

export default function ForecastPanel({ forecast, netWorth }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Zap className="w-4 h-4 text-primary" /> Forecast & Projections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/30">
            <p className="text-[10px] text-muted-foreground">Projected Income</p>
            <p className="text-xs font-bold font-mono text-income">{formatCurrency(forecast.projectedIncome)}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <p className="text-[10px] text-muted-foreground">Projected Expense</p>
            <p className="text-xs font-bold font-mono text-expense">{formatCurrency(forecast.projectedExpense)}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <p className="text-[10px] text-muted-foreground">Projected Savings</p>
            <p className={`text-xs font-bold font-mono ${forecast.projectedSavings >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(forecast.projectedSavings)}</p>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-muted/30">
          <p className="text-[10px] text-muted-foreground">12-Month Net Worth Projection</p>
          <p className="text-sm font-bold font-mono">{formatCurrency(forecast.yearProjection)}</p>
          <p className="text-[10px] text-muted-foreground">at {formatCurrency(forecast.monthlySavings)}/month savings rate</p>
        </div>
        {(forecast.overBudgets.length > 0 || forecast.atRiskBudgets.length > 0) && (
          <div className="space-y-1">
            {forecast.overBudgets.map(name => (
              <div key={name} className="flex items-center gap-1.5 text-xs text-expense">
                <AlertTriangle className="w-3 h-3" /> {name} is over budget
              </div>
            ))}
            {forecast.atRiskBudgets.map(name => (
              <div key={name} className="flex items-center gap-1.5 text-xs text-[hsl(var(--warning))]">
                <AlertTriangle className="w-3 h-3" /> {name} approaching limit
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
