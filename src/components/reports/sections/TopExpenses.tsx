import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt } from 'lucide-react';
import type { Transaction, Category } from '@/types/finance';

interface Props { expenses: Transaction[]; categories: Category[]; }

export default function TopExpenses({ expenses, categories }: Props) {
  if (expenses.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Receipt className="w-4 h-4 text-primary" /> Top Expenses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {expenses.map((t, i) => {
          const cat = categories.find(c => c.id === t.category_id);
          return (
            <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs w-5">{i + 1}.</span>
                <div>
                  <p className="font-medium text-xs">{t.description || 'No description'}</p>
                  <p className="text-[10px] text-muted-foreground">{cat?.name || 'Uncategorized'} • {formatDate(t.date)}</p>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-expense">-{formatCurrency(Number(t.amount), t.currency)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
