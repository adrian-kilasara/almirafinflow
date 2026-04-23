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
import { ACCOUNT_TYPE_ICONS, type AccountType, type CurrencyCode, type AccountClassification } from '@/types/finance';

const accountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['bank', 'mobile_money', 'cash', 'investment', 'crypto', 'other']),
  classification: z.enum(['asset', 'liability']),
  currency: z.enum(['KES', 'TZS', 'UGX', 'RWF', 'BIF', 'ETB', 'USD', 'EUR', 'GBP']),
  balance: z.string().refine(val => !isNaN(Number(val)), 'Must be a valid number'),
  institution_name: z.string().max(100).optional(),
  account_number: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  min_balance_alert: z.string().optional(),
  color: z.string().optional(),
}).refine(d => d.classification !== 'asset' || Number(d.balance) >= 0, {
  message: 'Asset accounts cannot have a negative balance. To track debt, switch to Liability.',
  path: ['balance'],
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
  onSuccess: () => void;
}

const assetTypes: { value: AccountType; label: string }[] = [
  { value: 'bank', label: 'Bank Account' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cash', label: 'Cash Wallet' },
  { value: 'investment', label: 'Investment / SACCO' },
  { value: 'crypto', label: 'Digital Wallet / Crypto' },
  { value: 'other', label: 'Other Asset' },
];

const liabilityTypes: { value: string; label: string }[] = [
  { value: 'bank', label: 'Bank Loan' },
  { value: 'mobile_money', label: 'Mobile Loan (Fuliza, etc.)' },
  { value: 'other', label: 'Credit Card / SACCO Loan / Informal Debt' },
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

const colors = [
  '#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f59e0b', '#ef4444', '#6366f1',
];

export default function AccountForm({ onSuccess }: AccountFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      type: 'bank',
      classification: 'asset',
      currency: 'TZS',
      balance: '0',
    },
  });

  const classification = watch('classification');

  const onSubmit = async (data: AccountFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const balance = Number(data.balance);
      const { error } = await supabase.from('accounts').insert({
        user_id: userData.user.id,
        name: data.name,
        type: data.type as AccountType,
        classification: data.classification,
        currency: data.currency as CurrencyCode,
        balance: balance,
        opening_balance: balance,
        color: selectedColor,
        icon: ACCOUNT_TYPE_ICONS[data.type as AccountType],
        institution_name: data.institution_name || null,
        account_number: data.account_number || null,
        notes: data.notes || null,
        min_balance_alert: data.min_balance_alert ? Number(data.min_balance_alert) : null,
      } as any);

      if (error) throw error;

      toast.success(`${data.classification === 'asset' ? 'Asset' : 'Liability'} account added!`);
      reset();
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add account');
    } finally {
      setLoading(false);
    }
  };

  const typeOptions = classification === 'asset' ? assetTypes : liabilityTypes;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Classification */}
          <div className="space-y-2">
            <Label>Classification</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['asset', 'liability'] as AccountClassification[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setValue('classification', c);
                    setValue('type', c === 'asset' ? 'bank' : 'bank');
                  }}
                  className={`p-3 rounded-lg border-2 transition-all text-center font-medium ${
                    classification === c
                      ? c === 'asset'
                        ? 'border-income bg-income/10 text-income'
                        : 'border-expense bg-expense/10 text-expense'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {c === 'asset' ? '📈 Asset' : '📉 Liability'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input placeholder={classification === 'asset' ? 'e.g., NMB Bank, M-Pesa' : 'e.g., CRDB Loan, Fuliza'} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select defaultValue="bank" onValueChange={(v) => setValue('type', v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {ACCOUNT_TYPE_ICONS[t.value as AccountType] || '💰'} {t.label}
                    </SelectItem>
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
              <Label>{classification === 'asset' ? 'Current Balance' : 'Amount Owed'}</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('balance')} />
              {errors.balance && <p className="text-xs text-destructive">{errors.balance.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Min Balance Alert</Label>
              <Input type="number" step="0.01" placeholder="Optional" {...register('min_balance_alert')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Institution</Label>
              <Input placeholder="e.g., CRDB, NMB, Vodacom" {...register('institution_name')} />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input placeholder="Last 4 digits" {...register('account_number')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Any additional details..." rows={2} {...register('notes')} />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
