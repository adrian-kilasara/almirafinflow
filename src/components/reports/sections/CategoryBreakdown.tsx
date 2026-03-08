import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import type { CategorySpend } from '../hooks/useReportData';

interface Props { data: CategorySpend[]; }

export default function CategoryBreakdown({ data }: Props) {
  return (
    <Card className="h-full overflow-hidden relative group">
      <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
            <PieIcon className="w-3.5 h-3.5 text-primary" />
          </div>
          Expense Categories
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '14px',
                    fontSize: '11px',
                    padding: '10px 14px',
                    boxShadow: '0 8px 32px hsl(var(--primary) / 0.08)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5">
              {data.slice(0, 6).map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center justify-between text-sm p-2 rounded-xl hover:bg-muted/30 transition-colors group/item"
                >
                  <div className="flex items-center gap-2.5">
                    <motion.div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.fill }}
                      whileHover={{ scale: 1.4 }}
                    />
                    <span className="text-muted-foreground truncate max-w-[120px] text-xs font-medium">{c.name}</span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="font-mono font-semibold text-xs">{formatCurrency(c.value)}</span>
                    <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md font-mono">{c.pctOfTotal.toFixed(0)}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No expenses this period</div>
        )}
      </CardContent>
    </Card>
  );
}
