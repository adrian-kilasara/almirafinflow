import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const fixedPct = fixedVsVariable.total > 0 ? (fixedVsVariable.fixed / fixedVsVariable.total) * 100 : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-3 h-3 text-primary" />
          </div>
          Accounts & Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {breakdown.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between text-xs p-2 rounded-xl hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {TYPE_LABELS[b.type] || b.type}
              <span className="text-muted-foreground text-[10px]">({b.count})</span>
            </span>
            <span className="font-mono font-medium">{formatCurrency(b.balance)}</span>
          </motion.div>
        ))}
        {fixedVsVariable.total > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fixed vs Variable</p>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
              {fixedPct > 0 && (
                <motion.div
                  className="bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${fixedPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              )}
              {(100 - fixedPct) > 0 && fixedVsVariable.variable > 0 && (
                <motion.div
                  className="bg-[hsl(var(--warning))] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - fixedPct}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Fixed: {formatCurrency(fixedVsVariable.fixed)}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--warning))] inline-block" /> Variable: {formatCurrency(fixedVsVariable.variable)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
