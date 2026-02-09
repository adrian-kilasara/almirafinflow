import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Trash2, Plus, CheckCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { differenceInDays } from 'date-fns';
import type { SavingsGoal, Account } from '@/types/finance';

const editSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  target_amount: z.string().min(1, 'Target is required').refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be positive'),
  target_date: z.string().optional(),
});

const addFundsSchema = z.object({
  amount: z.string().min(1, 'Amount is required').refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be positive'),
  account_id: z.string().min(1, 'Select an account'),
  notes: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;
type AddFundsFormData = z.infer<typeof addFundsSchema>;

interface SavingsGoalCardProps {
  goal: SavingsGoal;
  onRefresh: () => void;
}

export default function SavingsGoalCard({ goal, onRefresh }: SavingsGoalCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setAccounts(data as Account[]);
  };

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: goal.name,
      target_amount: String(goal.target_amount),
      target_date: goal.target_date || '',
    },
  });

  const addFundsForm = useForm<AddFundsFormData>({
    resolver: zodResolver(addFundsSchema),
    defaultValues: { amount: '', account_id: '', notes: '' },
  });

  const percentage = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
  const remaining = Number(goal.target_amount) - Number(goal.current_amount);
  const daysLeft = goal.target_date ? differenceInDays(new Date(goal.target_date), new Date()) : null;

  const handleEdit = async (data: EditFormData) => {
    setLoading(true);
    try {
      const newTargetAmount = Number(data.target_amount);
      const isCompleted = Number(goal.current_amount) >= newTargetAmount;
      
      const { error } = await supabase
        .from('savings_goals')
        .update({
          name: data.name,
          target_amount: newTargetAmount,
          target_date: data.target_date || null,
          is_completed: isCompleted,
        })
        .eq('id', goal.id);

      if (error) throw error;
      toast.success('Goal updated successfully');
      setEditOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update goal');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async (data: AddFundsFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const amount = Number(data.amount);
      const selectedAccount = accounts.find(a => a.id === data.account_id);
      
      if (!selectedAccount) throw new Error('Account not found');
      if (Number(selectedAccount.balance) < amount) {
        throw new Error('Insufficient balance in selected account');
      }

      // Insert savings allocation (trigger will update savings_goals.current_amount)
      const { error: allocError } = await supabase
        .from('savings_allocations')
        .insert({
          user_id: userData.user.id,
          savings_goal_id: goal.id,
          account_id: data.account_id,
          amount: amount,
          currency: goal.currency,
          notes: data.notes || null,
        });

      if (allocError) throw allocError;

      // Debit the account
      const { error: accountError } = await supabase
        .from('accounts')
        .update({ balance: Number(selectedAccount.balance) - amount })
        .eq('id', data.account_id);

      if (accountError) throw accountError;

      // Check if goal is now completed
      const newAmount = Number(goal.current_amount) + amount;
      if (newAmount >= Number(goal.target_amount)) {
        await supabase
          .from('savings_goals')
          .update({ is_completed: true })
          .eq('id', goal.id);
        toast.success('🎉 Goal completed!');
      } else {
        toast.success('Funds allocated successfully');
      }

      setAddFundsOpen(false);
      addFundsForm.reset();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add funds');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Fetch all allocations to refund account balances
      const { data: allocations } = await supabase
        .from('savings_allocations')
        .select('*')
        .eq('savings_goal_id', goal.id);

      // Refund each allocation back to its source account
      if (allocations && allocations.length > 0) {
        for (const alloc of allocations) {
          const account = accounts.find(a => a.id === alloc.account_id);
          if (account) {
            await supabase
              .from('accounts')
              .update({ balance: Number(account.balance) + Number(alloc.amount) })
              .eq('id', alloc.account_id);
          }
        }

        // Delete allocations first (foreign key constraint)
        await supabase
          .from('savings_allocations')
          .delete()
          .eq('savings_goal_id', goal.id);
      }

      const { error } = await supabase
        .from('savings_goals')
        .delete()
        .eq('id', goal.id);

      if (error) throw error;
      toast.success('Goal deleted and funds returned to accounts');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className={goal.is_completed ? 'border-income/50' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                style={{ backgroundColor: goal.color || '#14b8a6' + '20' }}
              >
                {goal.icon || '🎯'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{goal.name}</h3>
                  {goal.is_completed && (
                    <CheckCircle className="w-4 h-4 text-income" />
                  )}
                </div>
                {goal.target_date && (
                  <p className="text-sm text-muted-foreground">
                    {daysLeft !== null && daysLeft > 0 
                      ? `${daysLeft} days left`
                      : daysLeft === 0 
                        ? 'Due today'
                        : 'Past due'
                    }
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setAddFundsOpen(true)} disabled={goal.is_completed}>
                <Plus className="w-4 h-4" />
              </Button>
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
                        <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this savings goal and all associated allocations.
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
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-mono">{formatCurrency(Number(goal.current_amount), goal.currency)}</span>
              <span className="font-mono text-muted-foreground">{formatCurrency(Number(goal.target_amount), goal.currency)}</span>
            </div>
            <Progress value={percentage} className={goal.is_completed ? '[&>div]:bg-income' : ''} />
            <p className="text-sm text-muted-foreground text-right">
              {percentage.toFixed(1)}% • {formatCurrency(remaining, goal.currency)} to go
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Name</Label>
              <Input {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Target Amount</Label>
              <Input type="number" step="0.01" {...editForm.register('target_amount')} />
              {editForm.formState.errors.target_amount && (
                <p className="text-xs text-destructive">{editForm.formState.errors.target_amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Input type="date" {...editForm.register('target_date')} />
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

      {/* Add Funds Dialog - Now requires account selection */}
      <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Funds to {goal.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={addFundsForm.handleSubmit(handleAddFunds)} className="space-y-4">
            <div className="space-y-2">
              <Label>From Account</Label>
              <Select onValueChange={(value) => addFundsForm.setValue('account_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({formatCurrency(Number(account.balance), account.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addFundsForm.formState.errors.account_id && (
                <p className="text-xs text-destructive">{addFundsForm.formState.errors.account_id.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Amount ({goal.currency})</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...addFundsForm.register('amount')} />
              {addFundsForm.formState.errors.amount && (
                <p className="text-xs text-destructive">{addFundsForm.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Add a note..." rows={2} {...addFundsForm.register('notes')} />
            </div>
            <p className="text-sm text-muted-foreground">
              Current: {formatCurrency(Number(goal.current_amount), goal.currency)} • 
              Need: {formatCurrency(remaining, goal.currency)} more
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddFundsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Allocate Funds
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
