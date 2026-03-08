import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import type { CategorySpend } from '../hooks/useReportData';

interface Props { data: CategorySpend[]; }

export default function CategoryBreakdown({ data }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <PieIcon className="w-3 h-3 text-primary" />
          </div>
          Expense Categories
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {data.slice(0, 6).map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between text-sm p-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.fill }} />
                    <span className="text-muted-foreground truncate max-w-[120px] text-xs">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-medium text-xs">{formatCurrency(c.value)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({c.pctOfTotal.toFixed(0)}%)</span>
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
