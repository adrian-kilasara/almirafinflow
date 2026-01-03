import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Account, Category, TransactionType, CurrencyCode } from '@/types/finance';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().min(1, 'Amount is required').refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be a positive number'),
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  description: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  date: z.string().min(1, 'Date is required'),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface FloatingTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
}

export default function FloatingTransactionForm({ accounts, categories, onSuccess }: FloatingTransactionFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedAccountId = watch('account_id');
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const filteredCategories = categories.filter(c => c.type === transactionType);

  const handleOpen = (type: TransactionType) => {
    setTransactionType(type);
    setValue('type', type);
    setIsOpen(false);
    setDialogOpen(true);
  };

  const onSubmit = async (data: TransactionFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const currency = selectedAccount?.currency || 'KES';

      const { error } = await supabase.from('transactions').insert({
        user_id: userData.user.id,
        type: data.type as TransactionType,
        amount: Number(data.amount),
        account_id: data.account_id,
        category_id: data.category_id || null,
        description: data.description || null,
        notes: data.notes || null,
        date: data.date,
        currency: currency as CurrencyCode,
      });

      if (error) throw error;

      // Update account balance
      const balanceChange = data.type === 'income' ? Number(data.amount) : -Number(data.amount);
      await supabase
        .from('accounts')
        .update({ balance: (selectedAccount?.balance || 0) + balanceChange })
        .eq('id', data.account_id);

      toast.success('Transaction added successfully!');
      reset();
      setDialogOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  const actions = [
    { type: 'income' as TransactionType, icon: TrendingUp, label: 'Income', color: 'bg-income' },
    { type: 'expense' as TransactionType, icon: TrendingDown, label: 'Expense', color: 'bg-expense' },
    { type: 'transfer' as TransactionType, icon: ArrowLeftRight, label: 'Transfer', color: 'bg-primary' },
  ];

  const typeOptions = [
    { value: 'income', label: 'Income', icon: TrendingUp, color: 'text-income' },
    { value: 'expense', label: 'Expense', icon: TrendingDown, color: 'text-expense' },
    { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, color: 'text-primary' },
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FAB Container - Fixed at bottom center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
        {/* Action buttons */}
        <div className={cn(
          "flex gap-3 transition-all duration-300",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <div key={action.type} className="flex flex-col items-center gap-1">
                <Button
                  onClick={() => handleOpen(action.type)}
                  className={cn(
                    "w-14 h-14 rounded-full shadow-lg",
                    action.color,
                    "text-primary-foreground hover:opacity-90"
                  )}
                  size="icon"
                >
                  <Icon className="w-6 h-6" />
                </Button>
                <span className="text-xs font-medium text-foreground">{action.label}</span>
              </div>
            );
          })}
        </div>

        {/* Main FAB */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-16 h-16 rounded-full shadow-xl transition-all duration-300",
            "bg-primary hover:bg-primary/90",
            isOpen && "rotate-45"
          )}
          size="icon"
        >
          {isOpen ? (
            <X className="w-7 h-7" />
          ) : (
            <Plus className="w-7 h-7" />
          )}
        </Button>
      </div>

      {/* Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {transactionType === 'income' && <TrendingUp className="w-5 h-5 text-income" />}
              {transactionType === 'expense' && <TrendingDown className="w-5 h-5 text-expense" />}
              {transactionType === 'transfer' && <ArrowLeftRight className="w-5 h-5 text-primary" />}
              Add {transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Transaction Type Selector */}
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setTransactionType(option.value as TransactionType);
                      setValue('type', option.value as TransactionType);
                    }}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                      transactionType === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Icon className={cn("w-5 h-5", option.color)} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('amount')}
                  autoFocus
                />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" {...register('date')} />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Account</Label>
              <Select onValueChange={(value) => setValue('account_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.account_id && <p className="text-xs text-destructive">{errors.account_id.message}</p>}
            </div>

            {filteredCategories.length > 0 && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select onValueChange={(value) => setValue('category_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="What was this for?"
                {...register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional details..."
                rows={2}
                {...register('notes')}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? 'Adding...' : 'Add Transaction'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}