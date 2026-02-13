import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { CreditCard } from 'lucide-react';
import type { Account } from '@/types/finance';

const TYPE_LABELS: Record<string, string> = {
  bank: '🏦 Bank', mobile_money: '📱 Mobile Money', cash: '💵 Cash',
  investment: '📈 Investment', crypto: '₿ Crypto', other: '💰 Other'
};

interface Props {
  accounts: Account[];
  breakdown: { type: string; balance: number; count: number }[];
  fixedVsVariable: { fixed: number; variable: number; total: number };
}

export default function AccountBreakdownCard({ accounts, breakdown, fixedVsVariable }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="w-4 h-4 text-primary" /> Accounts & Expense Structure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {breakdown.map((b, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span>{TYPE_LABELS[b.type] || b.type} <span className="text-muted-foreground">({b.count})</span></span>
            <span className="font-mono font-medium">{formatCurrency(b.balance)}</span>
          </div>
        ))}
        {fixedVsVariable.total > 0 && (
          <div className="border-t border-border pt-2 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Fixed vs Variable Expenses</p>
            <div className="flex gap-2 h-3 rounded-full overflow-hidden bg-muted">
              {fixedVsVariable.fixed > 0 && <div className="bg-primary rounded-full" style={{ width: `${(fixedVsVariable.fixed / fixedVsVariable.total) * 100}%` }} />}
              {fixedVsVariable.variable > 0 && <div className="bg-[hsl(var(--warning))] rounded-full" style={{ width: `${(fixedVsVariable.variable / fixedVsVariable.total) * 100}%` }} />}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Fixed (recurring): {formatCurrency(fixedVsVariable.fixed)}</span>
              <span>Variable: {formatCurrency(fixedVsVariable.variable)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
