import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Zap, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  items: string[];
  spendingSpike: { pctAbove: number } | null;
}

export default function ActionBox({ items, spendingSpike }: Props) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] via-card to-card overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
      <CardHeader className="pb-3 relative">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          What To Do Now
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 relative">
        {spendingSpike && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-3 rounded-xl bg-expense/10 border border-expense/20 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-expense shrink-0" />
            <span className="text-xs text-expense font-medium">
              Today you spent {spendingSpike.pctAbove}% more than your 7-day average
            </span>
          </motion.div>
        )}
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors group"
          >
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
              <span className="text-[10px] font-bold text-primary">{i + 1}</span>
            </div>
            <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
