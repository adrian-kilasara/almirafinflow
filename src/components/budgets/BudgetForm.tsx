import { useState, useMemo } from 'react';
import { todayInTz } from '@/lib/datetime';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2, Lightbulb } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { emitBudgetEvent } from '@/lib/events';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import type { Category, BudgetPeriod, CurrencyCode, Transaction, SavingsGoal } from '@/types/finance';

const budgetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  amount: z.string().min(1, 'Amount is required').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  currency: z.enum(['KES', 'TZS', 'UGX', 'RWF', 'BIF', 'ETB', 'USD', 'EUR', 'GBP']),
  category_id: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

interface BudgetFormProps {
  categories: Category[];
  transactions?: Transaction[];
  savingsGoals?: SavingsGoal[];
  onSuccess: () => void;
}

const BUDGET_TEMPLATES = [
  { name: 'Student Budget', items: [
    { name: 'Food & Meals', amount: 150000 },
    { name: 'Transport', amount: 50000 },
    { name: 'Study Materials', amount: 30000 },
    { name: 'Entertainment', amount: 20000 },
  ]},
  { name: 'Family Budget', items: [
    { name: 'Groceries', amount: 400000 },
    { name: 'Rent & Utilities', amount: 500000 },
    { name: 'Transport', amount: 150000 },
    { name: 'Healthcare', amount: 100000 },
    { name: 'Education', amount: 200000 },
  ]},
  { name: 'Freelancer Budget', items: [
    { name: 'Business Expenses', amount: 200000 },
    { name: 'Food', amount: 300000 },
    { name: 'Transport', amount: 100000 },
    { name: 'Savings', amount: 250000 },
    { name: 'Tax Reserve', amount: 150000 },
  ]},
];

const periods: { value: BudgetPeriod; label: string; icon: string }[] = [
  { value: 'daily', label: 'Daily', icon: '📅' },
  { value: 'weekly', label: 'Weekly', icon: '📆' },
  { value: 'monthly', label: 'Monthly', icon: '🗓️' },
  { value: 'yearly', label: 'Yearly', icon: '📊' },
];

const currencies: CurrencyCode[] = ['KES', 'TZS', 'UGX', 'RWF', 'BIF', 'ETB', 'USD', 'EUR', 'GBP'];

export default function BudgetForm({ categories, transactions = [], savingsGoals = [], onSuccess }: BudgetFormProps) {
  const { settings } = useSettings();
  const userCurrency = (settings.default_currency || 'TZS') as CurrencyCode;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      period: 'monthly',
      currency: userCurrency,
      start_date: todayInTz(),
    },
  });

  const selectedCategoryId = watch('category_id');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // AI recommendation: average spending for selected category
  const recommendation = useMemo(() => {
    if (!selectedCategoryId || transactions.length === 0) return null;
    const catTxns = transactions.filter(t => t.type === 'expense' && t.category_id === selectedCategoryId);
    if (catTxns.length < 3) return null;

    // Get monthly average
    const amounts = catTxns.map(t => Number(t.amount));
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const monthlyAvg = avg * (catTxns.length / Math.max(1, Math.ceil((Date.now() - new Date(catTxns[catTxns.length - 1].date).getTime()) / (30 * 86400000))));
    const suggested = Math.ceil(monthlyAvg * 1.1 / 1000) * 1000; // Round up with 10% buffer
    const catName = categories.find(c => c.id === selectedCategoryId)?.name || 'this category';

    return { avg: monthlyAvg, suggested, catName };
  }, [selectedCategoryId, transactions, categories]);

  const onSubmit = async (data: BudgetFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('budgets').insert({
        user_id: userData.user.id,
        name: data.name,
        amount: Number(data.amount),
        period: data.period,
        currency: data.currency,
        category_id: data.category_id || null,
        start_date: data.start_date,
        end_date: data.end_date || null,
      });

      if (error) throw error;

      // Emit budget event
      await emitBudgetEvent(userData.user.id, data.name, Number(data.amount), data.period);

      toast.success('Budget created!');
      reset();
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create budget');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = async (template: typeof BUDGET_TEMPLATES[0]) => {
    if (!confirm(`Apply "${template.name}"? This will create ${template.items.length} live budgets in ${userCurrency}.`)) {
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const budgets = template.items.map(item => ({
        user_id: userData.user!.id,
        name: item.name,
        amount: item.amount,
        period: 'monthly' as BudgetPeriod,
        currency: userCurrency,
        start_date: todayInTz(),
      }));

      const { error } = await supabase.from('budgets').insert(budgets);
      if (error) throw error;

      toast.success(`Applied "${template.name}" — ${template.items.length} live budgets created in ${userCurrency}`);
      setShowTemplates(false);
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Create Budget
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Budget</DialogTitle>
        </DialogHeader>

        {/* Templates toggle */}
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="text-sm text-muted-foreground">Use a template?</span>
          <Button variant="ghost" size="sm" onClick={() => setShowTemplates(!showTemplates)} className="text-xs">
            {showTemplates ? 'Custom Budget' : 'Browse Templates'}
          </Button>
        </div>

        {showTemplates ? (
          <div className="space-y-3">
            {BUDGET_TEMPLATES.map((tpl) => (
              <div key={tpl.name} className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">{tpl.name}</h4>
                  <Button size="sm" variant="outline" onClick={() => applyTemplate(tpl)} disabled={loading}>
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {tpl.items.map(item => (
                    <div key={item.name} className="text-xs text-muted-foreground flex justify-between">
                      <span>{item.name}</span>
                      <span className="font-mono">{formatCurrency(item.amount, 'TZS')}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Total: {formatCurrency(tpl.items.reduce((s, i) => s + i.amount, 0), 'TZS')}/month
                </p>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Budget Name</Label>
              <Input placeholder="e.g., Food & Groceries" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select defaultValue="TZS" onValueChange={(v) => setValue('currency', v as CurrencyCode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Period selector */}
            <div className="space-y-2">
              <Label>Period</Label>
              <div className="grid grid-cols-4 gap-2">
                {periods.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setValue('period', p.value)}
                    className={cn(
                      "p-2 rounded-lg border-2 text-center transition-all",
                      watch('period') === p.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="text-lg">{p.icon}</span>
                    <p className="text-xs font-medium mt-0.5">{p.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            {expenseCategories.length > 0 && (
              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Select onValueChange={(v) => setValue('category_id', v)}>
                  <SelectTrigger><SelectValue placeholder="All expenses" /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* AI Recommendation */}
            {recommendation && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-medium text-foreground">Smart Suggestion</p>
                  <p className="text-muted-foreground mt-0.5">
                    You spend ~{formatCurrency(recommendation.avg)} on {recommendation.catName}. 
                    Recommended budget: <strong>{formatCurrency(recommendation.suggested)}</strong>
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={() => setValue('amount', String(recommendation.suggested))}
                  >
                    Apply suggestion
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" {...register('start_date')} />
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input type="date" {...register('end_date')} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {loading ? 'Creating...' : 'Create Budget'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
