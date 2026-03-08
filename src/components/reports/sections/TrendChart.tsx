import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { useSettings } from '@/hooks/useSettings';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { TrendPoint } from '../hooks/useReportData';

interface Props { data: TrendPoint[]; }

export default function TrendChart({ data }: Props) {
  const { settings } = useSettings();
  if (data.length === 0) return null;

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '12px',
    fontSize: '12px',
    color: 'hsl(var(--card-foreground))',
    padding: '8px 12px',
  };

  const renderCashFlowChart = () => {
    switch (settings.chart_preference) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="income" stroke="hsl(var(--income))" strokeWidth={2.5} dot={false} name="Income" />
            <Line type="monotone" dataKey="expense" stroke="hsl(var(--expense))" strokeWidth={2.5} dot={false} name="Expenses" />
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
            <Bar dataKey="income" fill="hsl(var(--income))" radius={[6, 6, 0, 0]} name="Income" />
            <Bar dataKey="expense" fill="hsl(var(--expense))" radius={[6, 6, 0, 0]} name="Expenses" />
          </BarChart>
        );
      default:
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--income))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--income))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--expense))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--expense))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="income" stroke="hsl(var(--income))" fill="url(#incomeGrad)" strokeWidth={2.5} name="Income" />
            <Area type="monotone" dataKey="expense" stroke="hsl(var(--expense))" fill="url(#expenseGrad)" strokeWidth={2.5} name="Expenses" />
          </AreaChart>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded-lg bg-income/10 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-income" />
              </div>
              Cash Flow Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              {renderCashFlowChart()}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-3 h-3 text-primary" />
              </div>
              Net Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="net" radius={[6, 6, 0, 0]} name="Net">
                  {data.map((entry, i) => <Cell key={i} fill={entry.net >= 0 ? 'hsl(var(--income))' : 'hsl(var(--expense))'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
