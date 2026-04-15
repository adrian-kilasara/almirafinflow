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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { ACCOUNT_TYPE_ICONS } from '@/types/finance';
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
  linked_account_id: z.string().optional(),
  institution_name: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface LoanFormProps {
  accounts: Account[];
  onSuccess: () => void;
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

export default function LoanForm({ accounts, onSuccess }: LoanFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const assetAccounts = accounts.filter(a => a.classification === 'asset' && a.is_active);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      loan_type: 'personal',
      currency: 'TZS',
      balance: '',
    },
  });

  const onSubmit = async (data: LoanFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const balance = Number(data.balance);
      const accountType = data.loan_type === 'mobile' ? 'mobile_money' : data.loan_type === 'mortgage' ? 'bank' : 'other';

      const { error } = await supabase.from('accounts').insert({
        user_id: userData.user.id,
        name: data.name,
        type: accountType as any,
        classification: 'liability',
        currency: data.currency as CurrencyCode,
        balance: balance,
        opening_balance: balance,
        color: '#ef4444',
        icon: data.loan_type === 'mortgage' ? '🏠' : data.loan_type === 'mobile' ? '📱' : data.loan_type === 'business' ? '💼' : data.loan_type === 'informal' ? '🤝' : '💳',
        institution_name: data.institution_name || null,
        notes: data.notes || null,
        interest_rate: data.interest_rate ? Number(data.interest_rate) : null,
        loan_term_months: data.loan_term_months ? Number(data.loan_term_months) : null,
        monthly_payment: data.monthly_payment ? Number(data.monthly_payment) : null,
        loan_start_date: data.loan_start_date || null,
        loan_type: data.loan_type,
        linked_account_id: data.linked_account_id || null,
      } as any);

      if (error) throw error;

      toast.success('Loan added successfully!');
      reset();
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add loan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Loan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Loan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Loan Name</Label>
            <Input placeholder="e.g., CRDB Personal Loan, Fuliza" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total Amount Owed</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('balance')} />
              {errors.balance && <p className="text-xs text-destructive">{errors.balance.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Interest Rate (%)</Label>
              <Input type="number" step="0.01" placeholder="e.g., 15.5" {...register('interest_rate')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Term (months)</Label>
              <Input type="number" placeholder="e.g., 24" {...register('loan_term_months')} />
            </div>
            <div className="space-y-2">
              <Label>Monthly Payment</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('monthly_payment')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Start Date</Label>
              <Input type="date" {...register('loan_start_date')} />
            </div>
            <div className="space-y-2">
              <Label>Payment From Account</Label>
              <Select onValueChange={(v) => setValue('linked_account_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {assetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.icon || ACCOUNT_TYPE_ICONS[a.type]} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Institution / Lender</Label>
            <Input placeholder="e.g., CRDB, NMB, Vodacom" {...register('institution_name')} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Any details about this loan..." rows={2} {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Loan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
