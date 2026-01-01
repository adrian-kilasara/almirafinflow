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
  DialogTrigger,
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
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
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

interface TransactionFormProps {
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
}

export default function TransactionForm({ accounts, categories, onSuccess }: TransactionFormProps) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  const typeOptions = [
    { value: 'income', label: 'Income', icon: TrendingUp, color: 'text-income' },
    { value: 'expense', label: 'Expense', icon: TrendingDown, color: 'text-expense' },
    { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, color: 'text-primary' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
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
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                    transactionType === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${option.color}`} />
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
