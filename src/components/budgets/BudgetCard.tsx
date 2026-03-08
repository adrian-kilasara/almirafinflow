import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { MoreHorizontal, Pencil, Trash2, Loader2, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { isWithinInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Budget, Transaction, Category, CurrencyCode } from '@/types/finance';

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
}

function getPeriodRange(period: string) {
  const now = new Date();
  switch (period) {
    case 'daily': return { start: startOfDay(now), end: endOfDay(now), totalDays: 1 };
    case 'weekly': return { start: startOfWeek(now), end: endOfWeek(now), totalDays: 7 };
    case 'monthly': return { start: startOfMonth(now), end: endOfMonth(now), totalDays: differenceInDays(endOfMonth(now), startOfMonth(now)) + 1 };
    case 'yearly': return { start: startOfYear(now), end: endOfYear(now), totalDays: 365 };
    default: return { start: startOfMonth(now), end: endOfMonth(now), totalDays: 30 };
  }
}

export default function BudgetCard({ budget, transactions, categories, rolloverEnabled = false, onRefresh }: BudgetCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: budget.name, amount: String(budget.amount) },
  });

  const budgetData = useMemo(() => {
    const { start, end, totalDays } = getPeriodRange(budget.period);
    const now = new Date();
    const elapsedDays = Math.max(1, differenceInDays(now, start) + 1);

    const relevantTxns = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const d = parseISO(t.date);
      const inPeriod = isWithinInterval(d, { start, end });
      return budget.category_id ? inPeriod && t.category_id === budget.category_id : inPeriod;
    });

    const spent = relevantTxns.reduce((s, t) => s + Number(t.amount), 0);
    const budgetAmount = Number(budget.amount);
    const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
    const remaining = budgetAmount - spent;

    // Forecasting
    const dailyRate = spent / elapsedDays;
    const projectedTotal = dailyRate * totalDays;
    const daysUntilExceed = remaining > 0 && dailyRate > 0 ? Math.floor(remaining / dailyRate) : null;
    const willExceed = projectedTotal > budgetAmount;

    // Status
    let status: 'safe' | 'warning' | 'danger' = 'safe';
    if (percentage >= 100) status = 'danger';
    else if (percentage >= 70) status = 'warning';

    // Top merchants
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
      spent,
      percentage: Math.min(percentage, 100),
      rawPercentage: percentage,
      remaining,
      isOverBudget: spent > budgetAmount,
      category: categories.find(c => c.id === budget.category_id),
      status,
      dailyRate,
      projectedTotal,
      daysUntilExceed,
      willExceed,
      relevantTxns,
      topMerchants,
      elapsedDays,
      totalDays,
    };
  }, [budget, transactions, categories]);

  const statusColors = {
    safe: 'text-income',
    warning: 'text-[hsl(var(--warning))]',
    danger: 'text-expense',
  };

  const progressColors = {
    safe: '',
    warning: '[&>div]:bg-[hsl(var(--warning))]',
    danger: '[&>div]:bg-destructive',
  };

  const handleEdit = async (data: EditFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('budgets').update({
        name: data.name,
        amount: Number(data.amount),
      }).eq('id', budget.id);
      if (error) throw error;
      toast.success('Budget updated');
      setEditOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className={cn(
        "transition-all hover:shadow-md",
        budgetData.isOverBudget && 'border-destructive/50 bg-destructive/5'
      )}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{budget.name}</h3>
                {budgetData.isOverBudget && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                {rolloverEnabled && <Badge variant="outline" className="text-[10px] shrink-0">Rollover</Badge>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="capitalize">{budget.period}</span>
                {budgetData.category && (
                  <>
                    <span>•</span>
                    <span>{budgetData.category.icon} {budgetData.category.name}</span>
                  </>
                )}
                <span>•</span>
                <span>Day {budgetData.elapsedDays}/{budgetData.totalDays}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDrilldownOpen(true)}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
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

          {/* Amount display */}
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className={cn("text-2xl font-bold font-mono", statusColors[budgetData.status])}>
                {formatCurrency(budgetData.spent, budget.currency)}
              </span>
              <span className="text-sm text-muted-foreground ml-1">
                / {formatCurrency(Number(budget.amount), budget.currency)}
              </span>
            </div>
            <Badge variant={budgetData.status === 'safe' ? 'secondary' : budgetData.status === 'warning' ? 'outline' : 'destructive'} className="text-xs">
              {Math.round(budgetData.rawPercentage)}%
            </Badge>
          </div>

          {/* Progress bar */}
          <Progress value={budgetData.percentage} className={cn("h-2.5 mb-2", progressColors[budgetData.status])} />

          {/* Footer stats */}
          <div className="flex items-center justify-between text-xs">
            <span className={budgetData.remaining >= 0 ? 'text-income' : 'text-expense'}>
              {budgetData.remaining >= 0
                ? `${formatCurrency(budgetData.remaining, budget.currency)} remaining`
                : `${formatCurrency(Math.abs(budgetData.remaining), budget.currency)} over budget`
              }
            </span>
            <span className="text-muted-foreground">
              ~{formatCurrency(budgetData.dailyRate, budget.currency)}/day
            </span>
          </div>

          {/* Forecast warning */}
          {budgetData.willExceed && !budgetData.isOverBudget && budgetData.daysUntilExceed !== null && (
            <div className="mt-2 p-2 rounded bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--warning))] shrink-0" />
              <p className="text-[11px] text-[hsl(var(--warning))]">
                At this pace, budget will be exceeded in {budgetData.daysUntilExceed} days
                (projected: {formatCurrency(budgetData.projectedTotal, budget.currency)})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drilldown Dialog */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{budget.name} — Breakdown</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Budget vs Actual */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Budget</p>
                <p className="font-mono font-bold">{formatCurrency(Number(budget.amount), budget.currency)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Spent</p>
                <p className={cn("font-mono font-bold", statusColors[budgetData.status])}>
                  {formatCurrency(budgetData.spent, budget.currency)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Difference</p>
                <p className={cn("font-mono font-bold", budgetData.remaining >= 0 ? 'text-income' : 'text-expense')}>
                  {budgetData.remaining >= 0 ? '+' : ''}{formatCurrency(budgetData.remaining, budget.currency)}
                </p>
              </div>
            </div>

            {/* Top Merchants */}
            {budgetData.topMerchants.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Top Spending</h4>
                <div className="space-y-1.5">
                  {budgetData.topMerchants.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                      <span className="truncate">{m.name}</span>
                      <span className="font-mono text-muted-foreground">{formatCurrency(m.amount, budget.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Transactions ({budgetData.relevantTxns.length})</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {budgetData.relevantTxns.slice(0, 20).map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/20">
                    <div>
                      <p className="font-medium">{(t as any).merchant || t.description || 'Transaction'}</p>
                      <p className="text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                    <span className="font-mono text-expense">-{formatCurrency(Number(t.amount), t.currency)}</span>
                  </div>
                ))}
                {budgetData.relevantTxns.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No transactions in this period</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Budget Name</Label>
              <Input {...form.register('name')} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Amount ({budget.currency})</Label>
              <Input type="number" step="0.01" {...form.register('amount')} />
              {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
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
