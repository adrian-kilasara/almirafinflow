import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import { todayInTz } from '@/lib/datetime';
import { ACCOUNT_TYPE_ICONS } from '@/types/finance';
import type { Account } from '@/types/finance';

const paymentSchema = z.object({
  amount: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be a positive number'),
  pay_from_account_id: z.string().min(1, 'Pick the account paying this'),
  principal_portion: z.string().optional(),
  interest_portion: z.string().optional(),
  payment_date: z.string().min(1, 'Date is required'),
  notes: z.string().max(500).optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface LoanPaymentFormProps {
  loan: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function LoanPaymentForm({ loan, open, onOpenChange, onSuccess }: LoanPaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const previousLinked = (loan as any).linked_account_id as string | null | undefined;

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('classification', 'asset')
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('name');
      if (data) setAccounts(data as Account[]);
    })();
  }, [open]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: (loan as any).monthly_payment ? String((loan as any).monthly_payment) : '',
      payment_date: todayInTz(),
      pay_from_account_id: previousLinked || '',
    },
  });

  // Default the picker to the previously-used account, if available
  useEffect(() => {
    if (open && previousLinked && !watch('pay_from_account_id')) {
      setValue('pay_from_account_id', previousLinked);
    }
  }, [open, previousLinked, setValue, watch]);

  const matchingCurrencyAccounts = useMemo(
    () => accounts.filter(a => a.currency === loan.currency),
    [accounts, loan.currency]
  );

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const amount = Number(data.amount);
      const principal = data.principal_portion ? Number(data.principal_portion) : amount;
      const interest = data.interest_portion ? Number(data.interest_portion) : 0;
      const payFromId = data.pay_from_account_id;

      // 1. Get the source account (re-fetch for fresh balance)
      const { data: sourceAcct, error: srcErr } = await supabase
        .from('accounts').select('balance, name, currency').eq('id', payFromId).single();
      if (srcErr || !sourceAcct) throw new Error('Source account not found');
      if (Number(sourceAcct.balance) < amount) {
        throw new Error(`Insufficient balance in ${sourceAcct.name}`);
      }

      // 2. Create repayment transaction (tagged so reports exclude from regular expenses)
      const { data: txn, error: txnError } = await supabase.from('transactions').insert({
        user_id: userData.user.id,
        account_id: payFromId,
        type: 'expense' as const,
        amount: amount,
        currency: loan.currency,
        description: `Loan repayment: ${loan.name}`,
        date: data.payment_date,
        notes: data.notes || null,
        tags: ['loan-repayment'],
        loan_account_id: loan.id,
      } as any).select('id').single();
      if (txnError) throw txnError;

      // 3. Record the loan_payment row
      const { error: payError } = await supabase.from('loan_payments').insert({
        user_id: userData.user.id,
        loan_account_id: loan.id,
        amount: amount,
        principal_portion: principal,
        interest_portion: interest,
        payment_date: data.payment_date,
        status: 'paid',
        transaction_id: txn.id,
        notes: data.notes || null,
      } as any);
      if (payError) throw payError;

      // 4. Reduce loan balance by principal portion + remember chosen source for next time
      const newLoanBalance = Math.max(0, Number(loan.balance) - principal);
      const { error: loanError } = await supabase.from('accounts')
        .update({ balance: newLoanBalance, linked_account_id: payFromId } as any).eq('id', loan.id);
      if (loanError) throw loanError;

      // 5. Reduce source asset balance by full payment
      const newSourceBalance = Number(sourceAcct.balance) - amount;
      await supabase.from('accounts').update({ balance: newSourceBalance }).eq('id', payFromId);

      // 6. Audit logs
      await supabase.from('account_audit_log').insert([
        {
          user_id: userData.user.id,
          account_id: loan.id,
          action: 'loan_payment',
          amount: amount,
          balance_before: Number(loan.balance),
          balance_after: newLoanBalance,
          notes: `Payment ${formatCurrency(amount, loan.currency)} — Principal ${formatCurrency(principal, loan.currency)}, Interest ${formatCurrency(interest, loan.currency)}`,
        },
        {
          user_id: userData.user.id,
          account_id: payFromId,
          action: 'loan_payment_sent',
          amount: amount,
          balance_before: Number(sourceAcct.balance),
          balance_after: newSourceBalance,
          notes: `Loan repayment: ${loan.name}`,
        },
      ]);

      toast.success(`Payment of ${formatCurrency(amount, loan.currency)} recorded`);
      reset({ amount: '', payment_date: todayInTz(), pay_from_account_id: payFromId });
      onOpenChange(false);
      onSuccess();
      window.dispatchEvent(new Event('dashboard-refresh'));
    } catch (error: any) {
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment — {loan.name}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-2">
          Outstanding: <span className="font-bold text-expense">{formatCurrency(Number(loan.balance), loan.currency)}</span>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Pay From Account</Label>
            <Select
              value={watch('pay_from_account_id')}
              onValueChange={(v) => setValue('pay_from_account_id', v)}
            >
              <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
              <SelectContent>
                {matchingCurrencyAccounts.length > 0 ? matchingCurrencyAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.icon || ACCOUNT_TYPE_ICONS[a.type]} {a.name} · {formatCurrency(Number(a.balance), a.currency)}
                  </SelectItem>
                )) : (
                  <div className="p-3 text-xs text-muted-foreground">
                    No active {loan.currency} accounts. Add one first.
                  </div>
                )}
              </SelectContent>
            </Select>
            {errors.pay_from_account_id && <p className="text-xs text-destructive">{errors.pay_from_account_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Payment Amount</Label>
            <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Principal Portion</Label>
              <Input type="number" step="0.01" placeholder="Auto" {...register('principal_portion')} />
              <p className="text-[9px] text-muted-foreground">Empty = full amount</p>
            </div>
            <div className="space-y-2">
              <Label>Interest Portion</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('interest_portion')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input type="date" {...register('payment_date')} />
            {errors.payment_date && <p className="text-xs text-destructive">{errors.payment_date.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Optional..." rows={2} {...register('notes')} />
          </div>

          <p className="text-[10px] text-muted-foreground">
            Repayments are excluded from your regular spending reports — they appear under Debt Activity instead.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-expense hover:bg-expense/90">
              {loading ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
