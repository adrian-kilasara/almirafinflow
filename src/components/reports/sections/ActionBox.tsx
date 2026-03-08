import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  items: string[];
  spendingSpike: { pctAbove: number } | null;
}

export default function ActionBox({ items, spendingSpike }: Props) {
  return (
    <Card className="overflow-hidden relative border-primary/20 bg-gradient-to-br from-primary/[0.03] via-card to-card">
      {/* Dual ambient glow */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/3 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

      <CardHeader className="pb-3 relative z-10">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <motion.div
            className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"
            animate={{ rotate: [0, 4, -4, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            <Zap className="w-4 h-4 text-primary" />
          </motion.div>
          What To Do Now
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 relative z-10">
        {spendingSpike && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-3 rounded-xl bg-expense/10 border border-expense/20 flex items-center gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-expense shrink-0" />
            <span className="text-xs text-expense font-semibold">
              Today you spent {spendingSpike.pctAbove}% more than your 7-day average
            </span>
          </motion.div>
        )}
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ x: 4, transition: { duration: 0.15 } }}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors group cursor-default"
          >
            <motion.div
              className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors"
              whileHover={{ scale: 1.1, rotate: 4 }}
            >
              <span className="text-[10px] font-black text-primary">{i + 1}</span>
            </motion.div>
            <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
