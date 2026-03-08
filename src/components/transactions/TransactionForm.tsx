import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, Loader2, Upload, X, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { emitTransactionEvent } from '@/lib/events';
import type { Account, Category, TransactionType, CurrencyCode } from '@/types/finance';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { value: 'mobile_money', label: 'Mobile Money', icon: '📱' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'cheque', label: 'Cheque', icon: '📝' },
  { value: 'other', label: 'Other', icon: '💰' },
];

const RECURRING_OPTIONS = [
  { value: '', label: 'Not Recurring' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().min(1, 'Amount is required').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  description: z.string().max(200).optional(),
  merchant: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  date: z.string().min(1, 'Date is required'),
  payment_method: z.string().default('cash'),
  recurring_interval: z.string().optional(),
  tags: z.string().optional(),
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
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
    },
  });

  const selectedAccountId = watch('account_id');
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const filteredCategories = categories.filter(c => c.type === transactionType);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const onSubmit = async (data: TransactionFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const currency = selectedAccount?.currency || 'KES';
      let receiptUrl: string | null = null;

      // Upload receipt if provided
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop();
        const path = `${userData.user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('receipts').upload(path, receiptFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: userData.user.id,
        type: data.type as TransactionType,
        amount: Number(data.amount),
        account_id: data.account_id,
        category_id: data.category_id || null,
        description: data.description || null,
        merchant: data.merchant || null,
        notes: data.notes || null,
        date: data.date,
        currency: currency as CurrencyCode,
        payment_method: data.payment_method || 'cash',
        recurring_interval: data.recurring_interval || null,
        tags: tags.length > 0 ? tags : [],
        receipt_url: receiptUrl,
        status: 'completed',
      } as any);

      if (error) throw error;

      // Update account balance
      const balanceChange = data.type === 'income' ? Number(data.amount) : -Number(data.amount);
      await supabase
        .from('accounts')
        .update({ balance: (selectedAccount?.balance || 0) + balanceChange })
        .eq('id', data.account_id);

      // Audit log
      await supabase.from('account_audit_log').insert({
        user_id: userData.user.id,
        account_id: data.account_id,
        action: 'transaction_added',
        amount: data.type === 'income' ? Number(data.amount) : -Number(data.amount),
        balance_before: selectedAccount?.balance || 0,
        balance_after: (selectedAccount?.balance || 0) + balanceChange,
        notes: `${data.type}: ${data.description || data.merchant || 'Transaction'}`,
      });

      // Emit cross-module event (notifications, budget alerts, low balance)
      await emitTransactionEvent(
        userData.user.id,
        data.type as 'income' | 'expense' | 'transfer',
        Number(data.amount),
        data.description || data.merchant || 'Transaction',
        data.account_id,
        data.category_id || null
      );

      toast.success('Transaction added successfully!');
      reset();
      setTags([]);
      setReceiptFile(null);
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
          <Plus className="w-4 h-4" /> Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Type Selector */}
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

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label>Account</Label>
            <Select onValueChange={(v) => setValue('account_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.is_active).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.icon || '💰'} {a.name} ({a.currency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.account_id && <p className="text-xs text-destructive">{errors.account_id.message}</p>}
          </div>

          {/* Category + Payment Method */}
          <div className="grid grid-cols-2 gap-4">
            {filteredCategories.length > 0 && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select onValueChange={(v) => setValue('category_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select defaultValue="cash" onValueChange={(v) => setValue('payment_method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Merchant */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" /> Merchant / Payee
            </Label>
            <Input placeholder="e.g., Shoppers, NMB Bank" {...register('merchant')} />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Input placeholder="What was this for?" {...register('description')} />
          </div>

          {/* Recurring */}
          <div className="space-y-2">
            <Label>Recurring</Label>
            <Select defaultValue="" onValueChange={(v) => setValue('recurring_interval', v)}>
              <SelectTrigger><SelectValue placeholder="Not recurring" /></SelectTrigger>
              <SelectContent>
                {RECURRING_OPTIONS.map((o) => (
                  <SelectItem key={o.value || 'none'} value={o.value || 'none'}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag, press Enter"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => removeTag(tag)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Receipt / Attachment</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {receiptFile ? receiptFile.name : 'Upload receipt (image/PDF)'}
            </Button>
            {receiptFile && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setReceiptFile(null)} className="text-xs text-destructive">
                Remove file
              </Button>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Additional details..." rows={2} {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {loading ? 'Adding...' : 'Add Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
