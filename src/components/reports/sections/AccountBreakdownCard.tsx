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
  const totalBalance = breakdown.reduce((s, b) => s + b.balance, 0);

  return (
    <Card className="h-full overflow-hidden relative group">
      <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-3.5 h-3.5 text-primary" />
          </div>
          Accounts & Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Account type breakdown with proportional bars */}
        {breakdown.map((b, i) => {
          const barPct = totalBalance > 0 ? (b.balance / totalBalance) * 100 : 0;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  {TYPE_LABELS[b.type] || b.type}
                  <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">{b.count}</span>
                </span>
                <span className="font-mono font-semibold">{formatCurrency(b.balance)}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(barPct, 2)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </motion.div>
          );
        })}

        {/* Fixed vs Variable */}
        {fixedVsVariable.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="border-t border-border/50 pt-3 space-y-2.5"
          >
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Fixed vs Variable</p>
            <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-muted">
              {fixedPct > 0 && (
                <motion.div
                  className="bg-primary rounded-l-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${fixedPct}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {(100 - fixedPct) > 0 && fixedVsVariable.variable > 0 && (
                <motion.div
                  className="bg-[hsl(var(--warning))] rounded-r-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - fixedPct}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Fixed: {formatCurrency(fixedVsVariable.fixed)}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--warning))] inline-block" /> Variable: {formatCurrency(fixedVsVariable.variable)}</span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
