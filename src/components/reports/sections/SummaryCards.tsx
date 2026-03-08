import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { TrendingUp, TrendingDown, Minus, Wallet, ArrowUpRight, ArrowDownRight, Percent } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  changes: { income: number; expense: number; net: number; savingsRate: number; };
  periodLabel: string;
}

function ChangeIndicator({ value, invert }: { value: number; invert?: boolean }) {
  const isPositive = invert ? value <= 0 : value >= 0;
  if (Math.abs(value) < 0.5) return <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" /> No change</span>;
  return (
    <span className={`text-[10px] flex items-center gap-1 font-medium ${isPositive ? 'text-income' : 'text-expense'}`}>
      {value > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

const cards = [
  { key: 'income', label: 'Income', icon: TrendingUp, colorClass: 'text-income', bgClass: 'bg-income/10', borderClass: 'border-[hsl(var(--income))]/20' },
  { key: 'expense', label: 'Expenses', icon: TrendingDown, colorClass: 'text-expense', bgClass: 'bg-expense/10', borderClass: 'border-[hsl(var(--expense))]/20' },
  { key: 'net', label: 'Net Flow', icon: Wallet, colorClass: '', bgClass: 'bg-primary/10', borderClass: 'border-primary/20' },
  { key: 'savings', label: 'Savings Rate', icon: Percent, colorClass: '', bgClass: 'bg-primary/10', borderClass: 'border-primary/20' },
];

export default function SummaryCards({ income, expense, net, savingsRate, changes, periodLabel }: Props) {
  const values = { income, expense, net, savings: savingsRate };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const val = values[card.key as keyof typeof values];
        const isNet = card.key === 'net';
        const isSavings = card.key === 'savings';
        const dynamicColor = isNet ? (net >= 0 ? 'text-income' : 'text-expense') : isSavings ? (savingsRate >= 20 ? 'text-income' : savingsRate >= 10 ? 'text-[hsl(var(--warning))]' : 'text-expense') : card.colorClass;

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            whileHover={{ y: -2, transition: { duration: 0.15 } }}
          >
            <Card className={`h-full border ${card.borderClass} hover:shadow-md transition-shadow`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{card.label}</p>
                  <div className={`w-7 h-7 rounded-lg ${card.bgClass} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${card.colorClass || 'text-primary'}`} />
                  </div>
                </div>
                <p className={`text-xl font-bold font-mono ${dynamicColor}`}>
                  {isSavings ? `${val.toFixed(1)}%` : `${isNet && val >= 0 ? '+' : ''}${formatCurrency(val)}`}
                </p>
                <div className="mt-1.5">
                  {isSavings ? (
                    <span className="text-[10px] text-muted-foreground">
                      {changes.savingsRate >= 0 ? '↑' : '↓'} {Math.abs(changes.savingsRate).toFixed(1)}pp vs last
                    </span>
                  ) : (
                    <ChangeIndicator value={changes[card.key as keyof typeof changes]} invert={card.key === 'expense'} />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
