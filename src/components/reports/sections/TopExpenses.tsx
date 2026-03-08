import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Transaction, Category } from '@/types/finance';

interface Props { expenses: Transaction[]; categories: Category[]; }

export default function TopExpenses({ expenses, categories }: Props) {
  if (expenses.length === 0) return null;
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-6 h-6 rounded-lg bg-expense/10 flex items-center justify-center">
            <Receipt className="w-3 h-3 text-expense" />
          </div>
          Top Expenses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {expenses.map((t, i) => {
          const cat = categories.find(c => c.id === t.category_id);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ x: 3 }}
              className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-default"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-expense/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-expense">{i + 1}</span>
                </div>
                <div>
                  <p className="font-medium text-xs">{t.description || 'No description'}</p>
                  <p className="text-[10px] text-muted-foreground">{cat?.name || 'Uncategorized'} • {formatDate(t.date)}</p>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-expense">-{formatCurrency(Number(t.amount), t.currency)}</span>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
