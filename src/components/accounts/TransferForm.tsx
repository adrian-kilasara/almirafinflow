import { useState } from 'react';
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
import { toast } from 'sonner';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { emitTransferEvent } from '@/lib/events';
import type { Account, CurrencyCode } from '@/types/finance';

const transferSchema = z.object({
  from_account_id: z.string().min(1, 'Select source'),
  to_account_id: z.string().min(1, 'Select destination'),
  amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  exchange_rate: z.string().optional(),
  description: z.string().max(200).optional(),
}).refine(d => d.from_account_id !== d.to_account_id, {
  message: 'Source and destination must differ',
  path: ['to_account_id'],
});

type TransferFormData = z.infer<typeof transferSchema>;

interface TransferFormProps {
  accounts: Account[];
  onSuccess: () => void;
}

export default function TransferForm({ accounts, onSuccess }: TransferFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { exchange_rate: '1' },
  });

  const fromId = watch('from_account_id');
  const toId = watch('to_account_id');
  const amount = watch('amount');
  const rate = watch('exchange_rate');

  const fromAcct = accounts.find(a => a.id === fromId);
  const toAcct = accounts.find(a => a.id === toId);
  const crossCurrency = fromAcct && toAcct && fromAcct.currency !== toAcct.currency;
  const convertedAmount = crossCurrency ? Number(amount || 0) * Number(rate || 1) : Number(amount || 0);

  const activeAccounts = accounts.filter(a => a.is_active && !(a as any).is_archived);

  const onSubmit = async (data: TransferFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const from = accounts.find(a => a.id === data.from_account_id)!;
      const to = accounts.find(a => a.id === data.to_account_id)!;
      const amt = Number(data.amount);
      const exRate = Number(data.exchange_rate || 1);
      const converted = from.currency !== to.currency ? amt * exRate : amt;

      // Create outflow transaction
      const { data: outTxn, error: e1 } = await supabase.from('transactions').insert({
        user_id: userData.user.id,
        account_id: from.id,
        type: 'transfer' as const,
        amount: amt,
        currency: from.currency,
        description: `Transfer to ${to.name}${data.description ? ` — ${data.description}` : ''}`,
        date: new Date().toISOString().split('T')[0],
      }).select('id').single();
      if (e1) throw e1;

      // Create inflow transaction
      const { data: inTxn, error: e2 } = await supabase.from('transactions').insert({
        user_id: userData.user.id,
        account_id: to.id,
        type: 'transfer' as const,
        amount: converted,
        currency: to.currency,
        description: `Transfer from ${from.name}${data.description ? ` — ${data.description}` : ''}`,
        date: new Date().toISOString().split('T')[0],
      }).select('id').single();
      if (e2) throw e2;

      // Update balances atomically
      await Promise.all([
        supabase.from('accounts').update({ balance: Number(from.balance) - amt }).eq('id', from.id),
        supabase.from('accounts').update({ balance: Number(to.balance) + converted }).eq('id', to.id),
      ]);

      // Log the transfer
      await supabase.from('transfers' as any).insert({
        user_id: userData.user.id,
        from_account_id: from.id,
        to_account_id: to.id,
        amount: amt,
        from_currency: from.currency,
        to_currency: to.currency,
        exchange_rate: exRate,
        converted_amount: converted,
        from_transaction_id: outTxn.id,
        to_transaction_id: inTxn.id,
        description: data.description || null,
        transfer_type: from.currency !== to.currency ? 'cross_currency' : 'internal',
      } as any);

      // Audit log both accounts
      const auditBase = { user_id: userData.user.id, action: 'transfer' };
      await Promise.all([
        supabase.from('account_audit_log' as any).insert({
          ...auditBase,
          account_id: from.id,
          amount: -amt,
          balance_before: from.balance,
          balance_after: Number(from.balance) - amt,
          notes: `Transfer to ${to.name}`,
        } as any),
        supabase.from('account_audit_log' as any).insert({
          ...auditBase,
          account_id: to.id,
          amount: converted,
          balance_before: to.balance,
          balance_after: Number(to.balance) + converted,
          notes: `Transfer from ${from.name}`,
        } as any),
      ]);

      toast.success(`Transferred ${formatCurrency(amt, from.currency)} → ${formatCurrency(converted, to.currency)}`);
      reset();
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowLeftRight className="w-4 h-4" /> Transfer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" /> Transfer Between Accounts
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>From Account</Label>
            <Select onValueChange={(v) => setValue('from_account_id', v)}>
              <SelectTrigger><SelectValue placeholder="Source account" /></SelectTrigger>
              <SelectContent>
                {activeAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.icon} {a.name} ({formatCurrency(Number(a.balance), a.currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.from_account_id && <p className="text-xs text-destructive">{errors.from_account_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>To Account</Label>
            <Select onValueChange={(v) => setValue('to_account_id', v)}>
              <SelectTrigger><SelectValue placeholder="Destination account" /></SelectTrigger>
              <SelectContent>
                {activeAccounts.filter(a => a.id !== fromId).map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.icon} {a.name} ({formatCurrency(Number(a.balance), a.currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.to_account_id && <p className="text-xs text-destructive">{errors.to_account_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Amount ({fromAcct?.currency || 'TZS'})</Label>
            <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          {crossCurrency && (
            <div className="space-y-2">
              <Label>Exchange Rate (1 {fromAcct?.currency} = ? {toAcct?.currency})</Label>
              <Input type="number" step="0.0001" {...register('exchange_rate')} />
              {convertedAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Recipient gets: {formatCurrency(convertedAmount, toAcct?.currency as CurrencyCode)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input placeholder="e.g., Moving savings to investment" {...register('description')} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowLeftRight className="w-4 h-4 mr-2" />}
              {loading ? 'Processing...' : 'Transfer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
