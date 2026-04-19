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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, AlertTriangle } from 'lucide-react';
import { todayInTz } from '@/lib/datetime';
import { formatCurrency } from '@/lib/format';
import type { Account, CurrencyCode } from '@/types/finance';

const loanSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  loan_type: z.string().min(1, 'Loan type is required'),
  currency: z.enum(['KES', 'TZS', 'UGX', 'RWF', 'BIF', 'ETB', 'USD', 'EUR', 'GBP']),
  balance: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be a positive number'),
  interest_rate: z.string().optional(),
  loan_term_months: z.string().optional(),
  monthly_payment: z.string().optional(),
  loan_start_date: z.string().optional(),
  institution_name: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface LoanFormProps {
  accounts: Account[];
  onSuccess: () => void;
  topUpFor?: Account | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

const loanTypes = [
  { value: 'personal', label: '💳 Personal Loan' },
  { value: 'mortgage', label: '🏠 Mortgage' },
  { value: 'business', label: '💼 Business Loan' },
  { value: 'mobile', label: '📱 Mobile Loan (Fuliza, etc.)' },
  { value: 'informal', label: '🤝 Informal Debt' },
];

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'TZS', label: 'TZS - Tanzanian Shilling' },
  { value: 'KES', label: 'KES - Kenyan Shilling' },
  { value: 'UGX', label: 'UGX - Ugandan Shilling' },
  { value: 'RWF', label: 'RWF - Rwandan Franc' },
  { value: 'BIF', label: 'BIF - Burundian Franc' },
  { value: 'ETB', label: 'ETB - Ethiopian Birr' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

export default function LoanForm({ accounts, onSuccess, topUpFor = null, open: controlledOpen, onOpenChange, hideTrigger = false }: LoanFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setInternalOpen(v); };
  const [loading, setLoading] = useState(false);

  const liabilityAccounts = useMemo(
    () => accounts.filter(a => a.classification === 'liability' && !a.is_archived),
    [accounts]
  );

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      loan_type: 'personal',
      currency: 'TZS',
      balance: '',
      loan_start_date: todayInTz(),
    },
  });

  const watchName = watch('name');
  const watchInstitution = watch('institution_name');
  const watchCurrency = watch('currency');

  // Pre-fill from topUpFor when opened in top-up mode
  useEffect(() => {
    if (open && topUpFor) {
      setValue('name', topUpFor.name);
      setValue('institution_name', topUpFor.institution_name || '');
      setValue('currency', topUpFor.currency as CurrencyCode);
      setValue('loan_type', (topUpFor as any).loan_type || 'personal');
      if ((topUpFor as any).interest_rate != null) setValue('interest_rate', String((topUpFor as any).interest_rate));
      if ((topUpFor as any).monthly_payment != null) setValue('monthly_payment', String((topUpFor as any).monthly_payment));
      if ((topUpFor as any).loan_term_months != null) setValue('loan_term_months', String((topUpFor as any).loan_term_months));
    }
  }, [open, topUpFor, setValue]);

  // Detect if a matching loan already exists → top-up flow
  const existingMatch = useMemo(() => {
    if (topUpFor) return topUpFor; // explicit top-up wins
    if (!watchName) return null;
    const nameLower = watchName.trim().toLowerCase();
    const instLower = (watchInstitution || '').trim().toLowerCase();
    return liabilityAccounts.find(l =>
      l.name.toLowerCase() === nameLower &&
      ((l.institution_name || '').toLowerCase() === instLower) &&
      l.currency === watchCurrency
    ) || null;
  }, [topUpFor, watchName, watchInstitution, watchCurrency, liabilityAccounts]);

  const onSubmit = async (data: LoanFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const principal = Number(data.balance);
      const today = todayInTz();

      let loanId: string;
      let actionLabel: string;

      if (existingMatch) {
        // TOP-UP existing loan — do not create a new account row
        const newBalance = Number(existingMatch.balance) + principal;
        const { error: upErr } = await supabase
          .from('accounts')
          .update({
            balance: newBalance,
            // refresh metadata if user provided it
            interest_rate: data.interest_rate ? Number(data.interest_rate) : (existingMatch as any).interest_rate,
            monthly_payment: data.monthly_payment ? Number(data.monthly_payment) : (existingMatch as any).monthly_payment,
            loan_term_months: data.loan_term_months ? Number(data.loan_term_months) : (existingMatch as any).loan_term_months,
          })
          .eq('id', existingMatch.id);
        if (upErr) throw upErr;

        await supabase.from('account_audit_log').insert({
          user_id: userData.user.id,
          account_id: existingMatch.id,
          action: 'loan_topup',
          amount: principal,
          balance_before: Number(existingMatch.balance),
          balance_after: newBalance,
          notes: `Top-up of ${formatCurrency(principal, existingMatch.currency)}`,
        });

        loanId = existingMatch.id;
        actionLabel = 'topped up';
      } else {
        // CREATE new liability account — pure debt record, no cash transaction
        const accountType = data.loan_type === 'mobile' ? 'mobile_money' : data.loan_type === 'mortgage' ? 'bank' : 'other';
        const { data: newAcct, error: insErr } = await supabase.from('accounts').insert({
          user_id: userData.user.id,
          name: data.name,
          type: accountType as any,
          classification: 'liability',
          currency: data.currency as CurrencyCode,
          balance: principal,
          opening_balance: principal,
          color: '#ef4444',
          icon: data.loan_type === 'mortgage' ? '🏠' : data.loan_type === 'mobile' ? '📱' : data.loan_type === 'business' ? '💼' : data.loan_type === 'informal' ? '🤝' : '💳',
          institution_name: data.institution_name || null,
          notes: data.notes || null,
          interest_rate: data.interest_rate ? Number(data.interest_rate) : null,
          loan_term_months: data.loan_term_months ? Number(data.loan_term_months) : null,
          monthly_payment: data.monthly_payment ? Number(data.monthly_payment) : null,
          loan_start_date: data.loan_start_date || today,
          loan_type: data.loan_type,
        } as any).select('id').single();
        if (insErr) throw insErr;

        loanId = newAcct.id;
        actionLabel = 'added';

        await supabase.from('account_audit_log').insert({
          user_id: userData.user.id,
          account_id: loanId,
          action: 'loan_created',
          amount: principal,
          balance_before: 0,
          balance_after: principal,
          notes: `Loan created — principal ${formatCurrency(principal, data.currency as CurrencyCode)}`,
        });
      }

      toast.success(`Loan ${actionLabel} — ${formatCurrency(principal, data.currency as CurrencyCode)} owed`);
      reset();
      setOpen(false);
      onSuccess();
      window.dispatchEvent(new Event('dashboard-refresh'));
    } catch (error: any) {
      toast.error(error.message || 'Failed to add loan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Loan
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingMatch ? 'Top Up Existing Loan' : 'Add New Loan'}</DialogTitle>
        </DialogHeader>

        {existingMatch && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-warning/30 bg-warning/5">
            <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-[10px]">
              <p className="font-bold text-warning">Existing loan detected</p>
              <p className="text-muted-foreground">
                "{existingMatch.name}" already exists with balance {formatCurrency(Number(existingMatch.balance), existingMatch.currency)}.
                Submitting will <strong>top it up</strong> instead of creating a duplicate.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Loan Name</Label>
            <Input placeholder="e.g., CRDB Personal Loan, Fuliza" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Type</Label>
              <Select defaultValue="personal" onValueChange={(v) => setValue('loan_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {loanTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select defaultValue="TZS" onValueChange={(v) => setValue('currency', v as CurrencyCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{existingMatch ? 'Top-up Amount' : 'Principal Borrowed'}</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('balance')} />
              {errors.balance && <p className="text-xs text-destructive">{errors.balance.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Interest Rate (%)</Label>
              <Input type="number" step="0.01" placeholder="e.g., 15.5" {...register('interest_rate')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Term (months)</Label>
              <Input type="number" placeholder="e.g., 24" {...register('loan_term_months')} />
            </div>
            <div className="space-y-2">
              <Label>Monthly Payment</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('monthly_payment')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Disbursement Date</Label>
              <Input type="date" {...register('loan_start_date')} />
            </div>
            <div className="space-y-2">
              <Label>Institution / Lender</Label>
              <Input placeholder="e.g., CRDB, NMB, Vodacom" {...register('institution_name')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Any details about this loan..." rows={2} {...register('notes')} />
          </div>

          <div className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-1">
            <p className="text-[10px] font-bold text-foreground">How loans work in FinFlow</p>
            <p className="text-[10px] text-muted-foreground">
              • This creates a <strong>liability record</strong> showing what you owe — no cash is added to any account.
            </p>
            <p className="text-[10px] text-muted-foreground">
              • If you actually received cash, log it as <strong>income</strong> on the receiving account separately.
            </p>
            <p className="text-[10px] text-muted-foreground">
              • Use <strong>"Record Payment"</strong> later to log repayments — they reduce this debt and your bank balance together.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : existingMatch ? 'Top Up Loan' : 'Add Loan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
