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
import { Plus, Sparkles } from 'lucide-react';
import type { CurrencyCode, Transaction } from '@/types/finance';

const goalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  target_amount: z.string().min(1, 'Target amount is required').refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be a positive number'),
  current_amount: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, 'Must be a valid number'),
  currency: z.enum(['KES', 'TZS', 'UGX', 'RWF', 'BIF', 'ETB', 'USD', 'EUR', 'GBP']),
  target_date: z.string().optional(),
});

type GoalFormData = z.infer<typeof goalSchema>;

interface SavingsGoalFormProps {
  onSuccess: () => void;
  transactions?: Transaction[];
}

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'KES', label: 'KES' }, { value: 'TZS', label: 'TZS' }, { value: 'UGX', label: 'UGX' },
  { value: 'RWF', label: 'RWF' }, { value: 'BIF', label: 'BIF' }, { value: 'ETB', label: 'ETB' },
  { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
];

const goalIcons = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '💍', '🎓', '🏥', '🎉'];
const colors = ['#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#6366f1'];

const templates = [
  { name: 'Emergency Fund', icon: '🏥', target: 500000, color: '#ef4444' },
  { name: 'Travel', icon: '✈️', target: 200000, color: '#3b82f6' },
  { name: 'New Car', icon: '🚗', target: 2000000, color: '#8b5cf6' },
  { name: 'Education', icon: '🎓', target: 1000000, color: '#f59e0b' },
  { name: 'House Down Payment', icon: '🏠', target: 5000000, color: '#22c55e' },
  { name: 'Wedding', icon: '💍', target: 3000000, color: '#ec4899' },
];

export default function SavingsGoalForm({ onSuccess, transactions = [] }: SavingsGoalFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(goalIcons[0]);
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: { currency: 'KES', current_amount: '0' },
  });

  // AI suggestion based on savings rate
  const getAISuggestion = () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const income = transactions.filter(t => t.type === 'income' && t.date >= monthStart).reduce((s, t) => s + Number(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'expense' && t.date >= monthStart).reduce((s, t) => s + Number(t.amount), 0);
    const surplus = income - expenses;
    if (surplus > 0) {
      const suggested = Math.round(surplus * 0.3);
      return `Based on your surplus this month, a good starting target is ${suggested.toLocaleString()}`;
    }
    return null;
  };

  const aiSuggestion = getAISuggestion();

  const applyTemplate = (t: typeof templates[0]) => {
    setValue('name', t.name);
    setValue('target_amount', String(t.target));
    setSelectedIcon(t.icon);
    setSelectedColor(t.color);
  };

  const onSubmit = async (data: GoalFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('savings_goals').insert({
        user_id: userData.user.id,
        name: data.name,
        target_amount: Number(data.target_amount),
        current_amount: Number(data.current_amount),
        currency: data.currency,
        target_date: data.target_date || null,
        icon: selectedIcon,
        color: selectedColor,
      });

      if (error) throw error;
      toast.success('Savings goal created!');
      reset();
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Goal</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Savings Goal</DialogTitle>
        </DialogHeader>

        {/* Templates */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Quick Templates</Label>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTemplate(t)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 transition-colors flex items-center gap-1"
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>
        </div>

        {aiSuggestion && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">{aiSuggestion}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {goalIcons.map((icon) => (
                <button
                  key={icon} type="button" onClick={() => setSelectedIcon(icon)}
                  className={`w-10 h-10 rounded-lg border-2 text-xl transition-all flex items-center justify-center ${
                    selectedIcon === icon ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                >{icon}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Goal Name</Label>
            <Input id="name" placeholder="e.g., Emergency Fund" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_amount">Target Amount</Label>
              <Input id="target_amount" type="number" step="0.01" placeholder="0.00" {...register('target_amount')} />
              {errors.target_amount && <p className="text-xs text-destructive">{errors.target_amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select defaultValue="KES" onValueChange={(v) => setValue('currency', v as CurrencyCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (<SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_amount">Already Saved</Label>
              <Input id="current_amount" type="number" step="0.01" placeholder="0.00" {...register('current_amount')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_date">Target Date</Label>
              <Input id="target_date" type="date" {...register('target_date')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color} type="button" onClick={() => setSelectedColor(color)}
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
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Goal'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
