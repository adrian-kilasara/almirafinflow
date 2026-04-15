import { useState } from 'react';
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
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import type { Account } from '@/types/finance';

const paymentSchema = z.object({
  amount: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be a positive number'),
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
  const linkedAccountId = (loan as any).linked_account_id;

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: (loan as any).monthly_payment ? String((loan as any).monthly_payment) : '',
      payment_date: new Date().toISOString().split('T')[0],
    },
  });

  const watchAmount = watch('amount');

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const amount = Number(data.amount);
      const principal = data.principal_portion ? Number(data.principal_portion) : amount;
      const interest = data.interest_portion ? Number(data.interest_portion) : 0;

      // 1. Create expense transaction on linked account (or loan account if no linked)
      const targetAccountId = linkedAccountId || loan.id;
      const { data: txn, error: txnError } = await supabase.from('transactions').insert({
        user_id: userData.user.id,
        account_id: targetAccountId,
        type: 'expense' as const,
        amount: amount,
        currency: loan.currency,
        description: `Loan payment: ${loan.name}`,
        date: data.payment_date,
        notes: data.notes || null,
        tags: ['loan-payment'],
      }).select('id').single();

      if (txnError) throw txnError;

      // 2. Record loan payment
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

      // 3. Reduce loan balance by principal portion
      const newLoanBalance = Math.max(0, Number(loan.balance) - principal);
      const { error: loanError } = await supabase.from('accounts')
        .update({ balance: newLoanBalance })
        .eq('id', loan.id);

      if (loanError) throw loanError;

      // 4. If linked asset account, reduce its balance too
      if (linkedAccountId && linkedAccountId !== loan.id) {
        const { data: linkedAcct } = await supabase.from('accounts')
          .select('balance').eq('id', linkedAccountId).single();
        
        if (linkedAcct) {
          const { error: linkedError } = await supabase.from('accounts')
            .update({ balance: Number(linkedAcct.balance) - amount })
            .eq('id', linkedAccountId);
          if (linkedError) throw linkedError;
        }
      }

      // 5. Audit log
      await supabase.from('account_audit_log').insert({
        user_id: userData.user.id,
        account_id: loan.id,
        action: 'loan_payment',
        amount: amount,
        balance_before: Number(loan.balance),
        balance_after: newLoanBalance,
        notes: `Payment of ${formatCurrency(amount, loan.currency)} — Principal: ${formatCurrency(principal, loan.currency)}, Interest: ${formatCurrency(interest, loan.currency)}`,
      });

      toast.success(`Payment of ${formatCurrency(amount, loan.currency)} recorded!`);
      reset();
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
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Record Payment — {loan.name}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-2">
          Outstanding: <span className="font-bold text-expense">{formatCurrency(Number(loan.balance), loan.currency)}</span>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Payment Amount</Label>
            <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Principal Portion</Label>
              <Input type="number" step="0.01" placeholder="Auto" {...register('principal_portion')} />
              <p className="text-[9px] text-muted-foreground">Leave empty = full amount</p>
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
