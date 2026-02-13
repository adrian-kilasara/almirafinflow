import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  if (Math.abs(value) < 0.5) return <span className="text-xs text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" /> No change</span>;
  return (
    <span className={`text-xs flex items-center gap-1 ${isPositive ? 'text-income' : 'text-expense'}`}>
      {value > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {value > 0 ? '+' : ''}{value.toFixed(1)}% vs last period
    </span>
  );
}

export default function SummaryCards({ income, expense, net, savingsRate, changes, periodLabel }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card variant="income">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="text-lg font-bold font-mono text-income mt-1">{formatCurrency(income)}</p>
          <ChangeIndicator value={changes.income} />
        </CardContent>
      </Card>
      <Card variant="expense">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="text-lg font-bold font-mono text-expense mt-1">{formatCurrency(expense)}</p>
          <ChangeIndicator value={changes.expense} invert />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Net Cash Flow</p>
          <p className={`text-lg font-bold font-mono mt-1 ${net >= 0 ? 'text-income' : 'text-expense'}`}>
            {net >= 0 ? '+' : ''}{formatCurrency(net)}
          </p>
          <ChangeIndicator value={changes.net} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Savings Rate</p>
          <p className={`text-lg font-bold font-mono mt-1 ${savingsRate >= 20 ? 'text-income' : savingsRate >= 10 ? 'text-[hsl(var(--warning))]' : 'text-expense'}`}>
            {savingsRate.toFixed(1)}%
          </p>
          <span className="text-xs text-muted-foreground">
            {changes.savingsRate >= 0 ? '↑' : '↓'} {Math.abs(changes.savingsRate).toFixed(1)}pp
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
