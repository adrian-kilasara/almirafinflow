import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { TrendingUp, TrendingDown, Minus, Wallet, ArrowUpRight, ArrowDownRight, Percent } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  changes: { income: number; expense: number; net: number; savingsRate: number };
  periodLabel: string;
}

function ChangeIndicator({ value, invert }: { value: number; invert?: boolean }) {
  const isPositive = invert ? value <= 0 : value >= 0;
  if (Math.abs(value) < 0.5) return <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" /> No change</span>;
  return (
    <span className={`text-[10px] flex items-center gap-1 font-semibold ${isPositive ? 'text-income' : 'text-expense'}`}>
      {value > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

const cards = [
  { key: 'income', label: 'Income', icon: TrendingUp, colorClass: 'text-income', bgClass: 'bg-income/10', glowClass: 'group-hover:shadow-[0_0_24px_hsl(var(--income)/0.12)]' },
  { key: 'expense', label: 'Expenses', icon: TrendingDown, colorClass: 'text-expense', bgClass: 'bg-expense/10', glowClass: 'group-hover:shadow-[0_0_24px_hsl(var(--expense)/0.12)]' },
  { key: 'net', label: 'Net Flow', icon: Wallet, colorClass: '', bgClass: 'bg-primary/10', glowClass: 'group-hover:shadow-[0_0_24px_hsl(var(--primary)/0.12)]' },
  { key: 'savings', label: 'Savings Rate', icon: Percent, colorClass: '', bgClass: 'bg-primary/10', glowClass: 'group-hover:shadow-[0_0_24px_hsl(var(--primary)/0.12)]' },
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
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="group"
          >
            <Card className={`h-full overflow-hidden relative transition-all duration-300 ${card.glowClass}`}>
              {/* Ambient glow */}
              <div className={`absolute -top-8 -right-8 w-20 h-20 rounded-full ${card.bgClass} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
              <CardContent className="p-4 relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{card.label}</p>
                  <motion.div
                    className={`w-8 h-8 rounded-xl ${card.bgClass} flex items-center justify-center`}
                    whileHover={{ rotate: 8, scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Icon className={`w-4 h-4 ${card.colorClass || 'text-primary'}`} />
                  </motion.div>
                </div>
                <motion.p
                  className={`text-xl font-black font-mono ${dynamicColor}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 + 0.2 }}
                >
                  {isSavings ? `${val.toFixed(1)}%` : `${isNet && val >= 0 ? '+' : ''}${formatCurrency(val)}`}
                </motion.p>
                <div className="mt-2">
                  {isSavings ? (
                    <span className="text-[10px] text-muted-foreground font-medium">
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
