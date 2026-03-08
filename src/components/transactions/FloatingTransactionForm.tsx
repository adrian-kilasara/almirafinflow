import { useState, useRef, forwardRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, X, Loader2, Upload, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { emitTransactionEvent } from '@/lib/events';
import type { Account, Category, TransactionType, CurrencyCode } from '@/types/finance';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().min(1, 'Required').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  account_id: z.string().min(1, 'Required'),
  category_id: z.string().optional(),
  description: z.string().max(200).optional(),
  merchant: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  date: z.string().min(1, 'Required'),
  payment_method: z.string().default('cash'),
  recurring_interval: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface FloatingTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
}

const FloatingTransactionForm = forwardRef<HTMLDivElement, FloatingTransactionFormProps>(
  function FloatingTransactionForm({ accounts, categories, onSuccess }, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [transactionType, setTransactionType] = useState<TransactionType>('expense');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<TransactionFormData>({
      resolver: zodResolver(transactionSchema),
      defaultValues: { type: 'expense', date: new Date().toISOString().split('T')[0], payment_method: 'cash' },
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

    const addTag = () => {
      const t = tagInput.trim();
      if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); setTagInput(''); }
    };

    const onSubmit = async (data: TransactionFormData) => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Not authenticated');

        const currency = selectedAccount?.currency || 'KES';
        let receiptUrl: string | null = null;

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

        const balanceChange = data.type === 'income' ? Number(data.amount) : -Number(data.amount);
        await supabase.from('accounts').update({ balance: (selectedAccount?.balance || 0) + balanceChange }).eq('id', data.account_id);

        await supabase.from('account_audit_log').insert({
          user_id: userData.user.id,
          account_id: data.account_id,
          action: 'transaction_added',
          amount: data.type === 'income' ? Number(data.amount) : -Number(data.amount),
          balance_before: selectedAccount?.balance || 0,
          balance_after: (selectedAccount?.balance || 0) + balanceChange,
          notes: `${data.type}: ${data.description || data.merchant || 'Transaction'}`,
        });

        // Emit cross-module event (notifications, budget alerts, low balance, streak)
        await emitTransactionEvent(
          userData.user.id,
          data.type as 'income' | 'expense' | 'transfer',
          Number(data.amount),
          data.description || data.merchant || 'Transaction',
          data.account_id,
          data.category_id || null
        );

        toast.success('Transaction added!');
        reset();
        setTags([]);
        setReceiptFile(null);
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
        {isOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />
        )}

        <div ref={ref} className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 sm:gap-3">
          <div className={cn(
            "flex gap-2 sm:gap-3 transition-all duration-300",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}>
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <div key={action.type} className="flex flex-col items-center gap-1">
                  <Button
                    onClick={() => handleOpen(action.type)}
                    className={cn("w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg", action.color, "text-primary-foreground hover:opacity-90")}
                    size="icon"
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                  <span className="text-[10px] sm:text-xs font-medium text-foreground">{action.label}</span>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-xl transition-all duration-300",
              "bg-primary hover:bg-primary/90",
              isOpen && "rotate-45"
            )}
            size="icon"
          >
            {isOpen ? <X className="w-6 h-6 sm:w-7 sm:h-7" /> : <Plus className="w-6 h-6 sm:w-7 sm:h-7" />}
          </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {transactionType === 'income' && <TrendingUp className="w-5 h-5 text-income" />}
                {transactionType === 'expense' && <TrendingDown className="w-5 h-5 text-expense" />}
                {transactionType === 'transfer' && <ArrowLeftRight className="w-5 h-5 text-primary" />}
                Add {transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { setTransactionType(option.value as TransactionType); setValue('type', option.value as TransactionType); }}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                        transactionType === option.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
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
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} autoFocus />
                  {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" {...register('date')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select onValueChange={(v) => setValue('account_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.is_active).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.icon || '💰'} {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.account_id && <p className="text-xs text-destructive">{errors.account_id.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select defaultValue="cash" onValueChange={(v) => setValue('payment_method', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">💵 Cash</SelectItem>
                      <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">📱 Mobile Money</SelectItem>
                      <SelectItem value="card">💳 Card</SelectItem>
                      <SelectItem value="other">💰 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                <Label className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Merchant / Payee</Label>
                <Input placeholder="e.g., Shoppers, NMB Bank" {...register('merchant')} />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="What was this for?" {...register('description')} />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                    placeholder="Add tag" className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                        {tag} <X className="w-3 h-3 cursor-pointer" onClick={() => setTags(prev => prev.filter(t => t !== tag))} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Receipt */}
              <div className="space-y-2">
                <Label>Receipt</Label>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                <Button type="button" variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> {receiptFile ? receiptFile.name : 'Upload receipt'}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Additional details..." rows={2} {...register('notes')} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {loading ? 'Adding...' : 'Add Transaction'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

export default FloatingTransactionForm;
