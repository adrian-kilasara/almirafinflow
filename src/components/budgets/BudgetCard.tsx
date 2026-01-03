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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Trash2, Pause, Play, Loader2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { isWithinInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import type { Budget, Transaction, Category } from '@/types/finance';

const editSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  amount: z.string().min(1, 'Amount is required').refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be positive'),
});

type EditFormData = z.infer<typeof editSchema>;

interface BudgetCardProps {
  budget: Budget;
  transactions: Transaction[];
  categories: Category[];
  onRefresh: () => void;
}

export default function BudgetCard({ budget, transactions, categories, onRefresh }: BudgetCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: budget.name,
      amount: String(budget.amount),
    },
  });

  const budgetData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (budget.period) {
      case 'daily':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'weekly':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'yearly':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
    }
    
    const relevantTransactions = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      
      const transactionDate = parseISO(t.date);
      const withinPeriod = isWithinInterval(transactionDate, { start: startDate, end: endDate });
      
      if (budget.category_id) {
        return withinPeriod && t.category_id === budget.category_id;
      }
      
      return withinPeriod;
    });
    
    const spent = relevantTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const percentage = (spent / Number(budget.amount)) * 100;
    const remaining = Number(budget.amount) - spent;
    
    return {
      spent,
      percentage: Math.min(percentage, 100),
      remaining,
      isOverBudget: spent > Number(budget.amount),
      category: categories.find(c => c.id === budget.category_id),
    };
  }, [budget, transactions, categories]);

  const handleEdit = async (data: EditFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('budgets')
        .update({
          name: data.name,
          amount: Number(data.amount),
        })
        .eq('id', budget.id);

      if (error) throw error;
      toast.success('Budget updated successfully');
      setEditOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update budget');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budget.id);

      if (error) throw error;
      toast.success('Budget deleted');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete budget');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className={budgetData.isOverBudget ? 'border-destructive/50' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{budget.name}</h3>
                {budgetData.isOverBudget && (
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="capitalize">{budget.period}</span>
                {budgetData.category && (
                  <>
                    <span>•</span>
                    <span>{budgetData.category.icon} {budgetData.category.name}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right mr-2">
                <p className="font-mono font-semibold">
                  {formatCurrency(budgetData.spent, budget.currency)} / {formatCurrency(Number(budget.amount), budget.currency)}
                </p>
                <p className={`text-sm ${budgetData.remaining >= 0 ? 'text-income' : 'text-expense'}`}>
                  {budgetData.remaining >= 0 
                    ? `${formatCurrency(budgetData.remaining, budget.currency)} left`
                    : `${formatCurrency(Math.abs(budgetData.remaining), budget.currency)} over`
                  }
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Budget?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this budget. Your transaction history will be preserved.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Progress 
            value={budgetData.percentage} 
            className={`h-2 ${budgetData.isOverBudget ? '[&>div]:bg-destructive' : ''}`}
          />
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Budget Name</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Amount ({budget.currency})</Label>
              <Input type="number" step="0.01" {...register('amount')} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
