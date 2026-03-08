import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { Zap, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-3 h-3 text-primary" />
          </div>
          Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Income', value: forecast.projectedIncome, color: 'text-income' },
            { label: 'Expense', value: forecast.projectedExpense, color: 'text-expense' },
            { label: 'Savings', value: forecast.projectedSavings, color: forecast.projectedSavings >= 0 ? 'text-income' : 'text-expense' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="p-2.5 rounded-xl bg-muted/30"
            >
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={`text-xs font-bold font-mono ${item.color}`}>{formatCurrency(item.value)}</p>
            </motion.div>
          ))}
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">12-Month Net Worth</p>
          <p className="text-lg font-bold font-mono">{formatCurrency(forecast.yearProjection)}</p>
          <p className="text-[10px] text-muted-foreground">at {formatCurrency(forecast.monthlySavings)}/mo savings</p>
        </div>
        {(forecast.overBudgets.length > 0 || forecast.atRiskBudgets.length > 0) && (
          <div className="space-y-1.5">
            {forecast.overBudgets.map(name => (
              <div key={name} className="flex items-center gap-1.5 text-xs text-expense p-1.5 rounded-lg bg-expense/5">
                <AlertTriangle className="w-3 h-3" /> {name} over budget
              </div>
            ))}
            {forecast.atRiskBudgets.map(name => (
              <div key={name} className="flex items-center gap-1.5 text-xs text-[hsl(var(--warning))] p-1.5 rounded-lg bg-[hsl(var(--warning))]/5">
                <AlertTriangle className="w-3 h-3" /> {name} at risk
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
