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
    <Card className="h-full overflow-hidden relative group">
      <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Income', value: forecast.projectedIncome, color: 'text-income' },
            { label: 'Expense', value: forecast.projectedExpense, color: 'text-expense' },
            { label: 'Savings', value: forecast.projectedSavings, color: forecast.projectedSavings >= 0 ? 'text-income' : 'text-expense' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="p-2.5 rounded-xl bg-muted/30 border border-border/30"
            >
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</p>
              <p className={`text-xs font-black font-mono mt-0.5 ${item.color}`}>{formatCurrency(item.value)}</p>
            </motion.div>
          ))}
        </div>

        {/* 12-Month Net Worth */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-3.5 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 relative overflow-hidden"
        >
          <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
          <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">12-Month Net Worth</p>
          <p className="text-lg font-black font-mono mt-0.5">{formatCurrency(forecast.yearProjection)}</p>
          <p className="text-[10px] text-muted-foreground font-medium">at {formatCurrency(forecast.monthlySavings)}/mo savings</p>
        </motion.div>

        {(forecast.overBudgets.length > 0 || forecast.atRiskBudgets.length > 0) && (
          <div className="space-y-1.5">
            {forecast.overBudgets.map((name, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="flex items-center gap-2 text-xs text-expense p-2 rounded-xl bg-expense/5 border border-expense/10"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {name} over budget
              </motion.div>
            ))}
            {forecast.atRiskBudgets.map((name, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="flex items-center gap-2 text-xs text-[hsl(var(--warning))] p-2 rounded-xl bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/10"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {name} at risk
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
