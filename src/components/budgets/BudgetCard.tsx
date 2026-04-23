import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Trash2, Loader2, AlertTriangle, Eye, Zap, Calendar, TrendingDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { isWithinInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import type { Budget, Transaction, Category } from '@/types/finance';

const editSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
});

type EditFormData = z.infer<typeof editSchema>;

interface BudgetCardProps {
  budget: Budget;
  transactions: Transaction[];
  categories: Category[];
  rolloverEnabled?: boolean;
  onRefresh: () => void;
  index?: number;
}

function getPeriodRange(period: string, budgetStartDate?: string | null) {
  const now = new Date();
  // Parse YYYY-MM-DD safely (no UTC slip)
  const budgetStart = budgetStartDate
    ? new Date(`${budgetStartDate}T00:00:00`)
    : null;

  let start: Date, end: Date, totalDays: number;
  switch (period) {
    case 'daily':   start = startOfDay(now);   end = endOfDay(now);   totalDays = 1; break;
    case 'weekly':  start = startOfWeek(now);  end = endOfWeek(now);  totalDays = 7; break;
    case 'monthly': start = startOfMonth(now); end = endOfMonth(now); totalDays = differenceInDays(endOfMonth(now), startOfMonth(now)) + 1; break;
    case 'yearly':  start = startOfYear(now);  end = endOfYear(now);  totalDays = 365; break;
    default:        start = startOfMonth(now); end = endOfMonth(now); totalDays = 30; break;
  }
  // ✅ Honor budget start_date — never count txns from before this budget existed
  if (budgetStart && budgetStart > start) {
    start = startOfDay(budgetStart);
    totalDays = Math.max(1, differenceInDays(end, start) + 1);
  }
  return { start, end, totalDays };
}

export default function BudgetCard({ budget, transactions, categories, rolloverEnabled = false, onRefresh, index = 0 }: BudgetCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: budget.name, amount: String(budget.amount) },
  });

  const budgetData = useMemo(() => {
    const { start, end, totalDays } = getPeriodRange(budget.period, (budget as any).start_date);
    const now = new Date();
    const elapsedDays = Math.max(1, differenceInDays(now, start) + 1);

    const relevantTxns = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      // Currency must match — never sum TZS into a USD budget
      if (t.currency !== budget.currency) return false;
      const d = parseISO(t.date);
      const inPeriod = isWithinInterval(d, { start, end });
      return budget.category_id ? inPeriod && t.category_id === budget.category_id : inPeriod;
    });

    const spent = relevantTxns.reduce((s, t) => s + Number(t.amount), 0);
    const budgetAmount = Number(budget.amount);
    const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
    const remaining = budgetAmount - spent;

    const dailyRate = spent / elapsedDays;
    const projectedTotal = dailyRate * totalDays;
    const daysUntilExceed = remaining > 0 && dailyRate > 0 ? Math.floor(remaining / dailyRate) : null;
    const willExceed = projectedTotal > budgetAmount;

    let status: 'safe' | 'warning' | 'danger' = 'safe';
    if (percentage >= 100) status = 'danger';
    else if (percentage >= 70) status = 'warning';

    const merchantMap: Record<string, number> = {};
    relevantTxns.forEach(t => {
      const key = (t as any).merchant || t.description || 'Other';
      merchantMap[key] = (merchantMap[key] || 0) + Number(t.amount);
    });
    const topMerchants = Object.entries(merchantMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    return {
      spent, percentage: Math.min(percentage, 100), rawPercentage: percentage,
      remaining, isOverBudget: spent > budgetAmount,
      category: categories.find(c => c.id === budget.category_id),
      status, dailyRate, projectedTotal, daysUntilExceed, willExceed,
      relevantTxns, topMerchants, elapsedDays, totalDays,
    };
  }, [budget, transactions, categories]);

  // Circular progress values
  const circleRadius = 38;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (budgetData.percentage / 100) * circumference;

  const statusConfig = {
    safe: { color: 'hsl(var(--income))', label: 'On Track', bgClass: 'bg-income/5 border-income/15' },
    warning: { color: 'hsl(var(--warning))', label: 'Caution', bgClass: 'bg-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/15' },
    danger: { color: 'hsl(var(--expense))', label: 'Over', bgClass: 'bg-expense/5 border-expense/15' },
  };

  const cfg = statusConfig[budgetData.status];

  const handleEdit = async (data: EditFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('budgets').update({
        name: data.name, amount: Number(data.amount),
      }).eq('id', budget.id);
      if (error) throw error;
      toast.success('Budget updated');
      setEditOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', budget.id);
      if (error) throw error;
      toast.success('Budget deleted');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    } finally { setLoading(false); }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -4, transition: { duration: 0.25 } }}
        layout
      >
        <div
          className={`group relative overflow-hidden rounded-2xl border cursor-pointer transition-all duration-500 bg-card ${
            budgetData.isOverBudget
              ? 'border-expense/30 shadow-[0_0_30px_-8px_hsl(var(--expense)/0.15)]'
              : 'border-border/40 hover:border-primary/30 hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.15)]'
          }`}
          onClick={() => setDrilldownOpen(true)}
        >
          {/* Ambient glow */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{ background: `radial-gradient(ellipse 70% 50% at 85% 25%, ${cfg.color}10, transparent 65%)` }}
          />

          {/* Top accent */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 0.5, scaleX: 1 }}
            transition={{ delay: index * 0.07 + 0.3, duration: 0.6 }}
          />

          <div className="relative p-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors duration-300">
                    {budget.name}
                  </h3>
                  {budgetData.isOverBudget && (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                      <AlertTriangle className="w-3.5 h-3.5 text-expense shrink-0" />
                    </motion.div>
                  )}
                  {rolloverEnabled && <Badge variant="outline" className="text-[9px] h-4 shrink-0">Rollover</Badge>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.bgClass}`}>
                    {budgetData.status === 'safe' ? '✓' : budgetData.status === 'warning' ? '⚡' : '!'} {cfg.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">{budget.period}</span>
                  {budgetData.category && (
                    <span className="text-[10px] text-muted-foreground">
                      · {budgetData.category.icon} {budgetData.category.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Circular progress */}
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r={circleRadius} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" strokeOpacity="0.3" />
                  <motion.circle
                    cx="44" cy="44" r={circleRadius}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ delay: index * 0.07 + 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-lg font-extrabold font-mono leading-none"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.07 + 0.5 }}
                    style={{ color: cfg.color }}
                  >
                    {Math.round(budgetData.rawPercentage)}%
                  </motion.span>
                  <span className="text-[8px] text-muted-foreground mt-0.5">used</span>
                </div>
              </div>
            </div>

            {/* Amount breakdown */}
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-0.5">Spent</p>
                <motion.p
                  className="text-xl font-extrabold font-mono tracking-tight"
                  style={{ color: cfg.color }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.07 + 0.4 }}
                >
                  {formatCurrency(budgetData.spent, budget.currency)}
                </motion.p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-0.5">Budget</p>
                <p className="text-sm font-mono font-semibold text-muted-foreground">
                  {formatCurrency(Number(budget.amount), budget.currency)}
                </p>
              </div>
            </div>

            {/* Linear progress bar */}
            <div className="h-2 rounded-full overflow-hidden bg-muted/30 mb-3">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: cfg.color }}
                initial={{ width: 0 }}
                animate={{ width: `${budgetData.percentage}%` }}
                transition={{ delay: index * 0.07 + 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            {/* Bottom stats */}
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center px-2 py-1.5 rounded-xl bg-muted/20">
                <p className="text-[8px] text-muted-foreground uppercase tracking-widest">Remaining</p>
                <p className={`text-[11px] font-mono font-bold ${budgetData.remaining >= 0 ? 'text-income' : 'text-expense'}`}>
                  {budgetData.remaining >= 0 ? '' : '-'}{formatCurrency(Math.abs(budgetData.remaining), budget.currency)}
                </p>
              </div>
              <div className="text-center px-2 py-1.5 rounded-xl bg-muted/20">
                <p className="text-[8px] text-muted-foreground uppercase tracking-widest">Daily Rate</p>
                <p className="text-[11px] font-mono font-bold text-muted-foreground">
                  {formatCurrency(budgetData.dailyRate, budget.currency)}
                </p>
              </div>
              <div className="text-center px-2 py-1.5 rounded-xl bg-muted/20">
                <p className="text-[8px] text-muted-foreground uppercase tracking-widest">Day</p>
                <p className="text-[11px] font-mono font-bold text-muted-foreground">
                  {budgetData.elapsedDays}/{budgetData.totalDays}
                </p>
              </div>
            </div>

            {/* Forecast warning */}
            {budgetData.willExceed && !budgetData.isOverBudget && budgetData.daysUntilExceed !== null && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ delay: index * 0.07 + 0.8 }}
                className="mt-3 p-2.5 rounded-xl bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/15 flex items-start gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                <div className="text-[10px]">
                  <p className="font-semibold text-[hsl(var(--warning))]">
                    Exceeded in ~{budgetData.daysUntilExceed}d
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    Projected: {formatCurrency(budgetData.projectedTotal, budget.currency)}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Action buttons - visible on hover */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/20">
              <div className="flex items-center gap-1.5">
                <Zap className="w-2.5 h-2.5 text-primary/50" />
                <p className="text-[9px] text-muted-foreground">{budgetData.relevantTxns.length} transactions</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDrilldownOpen(true); }}>
                      <Eye className="w-4 h-4 mr-2" /> View Details
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Budget?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete this budget.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Drilldown Dialog */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">{budgetData.category?.icon || '📊'}</span>
              {budget.name} — Breakdown
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Budget', value: formatCurrency(Number(budget.amount), budget.currency), color: '' },
                { label: 'Spent', value: formatCurrency(budgetData.spent, budget.currency), color: cfg.color },
                { label: 'Difference', value: `${budgetData.remaining >= 0 ? '+' : ''}${formatCurrency(budgetData.remaining, budget.currency)}`, color: budgetData.remaining >= 0 ? 'hsl(var(--income))' : 'hsl(var(--expense))' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="text-center p-3 rounded-xl bg-muted/20 border border-border/20"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="font-mono font-bold text-sm" style={stat.color ? { color: stat.color } : {}}>
                    {stat.value}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Top Spending */}
            {budgetData.topMerchants.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3" /> Top Spending
                </h4>
                <div className="space-y-1.5">
                  {budgetData.topMerchants.map((m, i) => {
                    const pct = Number(budget.amount) > 0 ? (m.amount / Number(budget.amount)) * 100 : 0;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="relative overflow-hidden rounded-xl bg-muted/15 border border-transparent hover:border-border/30 transition-all p-3"
                      >
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-expense/5"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }}
                        />
                        <div className="relative flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{m.name}</span>
                          <span className="font-mono text-sm text-muted-foreground shrink-0 ml-2">{formatCurrency(m.amount, budget.currency)}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Transactions ({budgetData.relevantTxns.length})
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {budgetData.relevantTxns.slice(0, 20).map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/10 hover:bg-muted/25 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{(t as any).merchant || t.description || 'Transaction'}</p>
                      <p className="text-muted-foreground text-[10px]">{formatDate(t.date)}</p>
                    </div>
                    <span className="font-mono text-expense font-semibold">-{formatCurrency(Number(t.amount), t.currency)}</span>
                  </motion.div>
                ))}
                {budgetData.relevantTxns.length === 0 && (
                  <div className="text-center py-8">
                    <Zap className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No transactions in this period</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Budget Name</Label>
              <Input {...form.register('name')} className="rounded-xl" />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Amount ({budget.currency})</Label>
              <Input type="number" step="0.01" {...form.register('amount')} className="rounded-xl" />
              {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={loading} className="rounded-xl">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
