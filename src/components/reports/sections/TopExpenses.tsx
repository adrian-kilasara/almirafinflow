import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Transaction, Category } from '@/types/finance';

interface Props { expenses: Transaction[]; categories: Category[]; }

export default function TopExpenses({ expenses, categories }: Props) {
  if (expenses.length === 0) return null;

  const maxAmount = Math.max(...expenses.map(t => Number(t.amount)), 1);

  return (
    <Card className="h-full overflow-hidden relative group">
      <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-expense/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <div className="w-7 h-7 rounded-xl bg-expense/10 flex items-center justify-center">
            <Receipt className="w-3.5 h-3.5 text-expense" />
          </div>
          Top Expenses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {expenses.map((t, i) => {
          const cat = categories.find(c => c.id === t.category_id);
          const barWidth = (Number(t.amount) / maxAmount) * 100;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ x: 3, transition: { duration: 0.15 } }}
              className="relative overflow-hidden rounded-xl cursor-default"
            >
              {/* Background bar */}
              <motion.div
                className="absolute inset-y-0 left-0 bg-expense/5 rounded-xl"
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
              <div className="relative z-10 flex items-center justify-between p-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-expense/10 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-expense">{i + 1}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-xs">{t.description || 'No description'}</p>
                    <p className="text-[10px] text-muted-foreground">{cat?.name || 'Uncategorized'} • {formatDate(t.date)}</p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-expense">-{formatCurrency(Number(t.amount), t.currency)}</span>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
