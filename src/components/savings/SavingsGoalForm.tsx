import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { CurrencyCode } from '@/types/finance';

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
}

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'KES', label: 'KES' },
  { value: 'TZS', label: 'TZS' },
  { value: 'UGX', label: 'UGX' },
  { value: 'RWF', label: 'RWF' },
  { value: 'BIF', label: 'BIF' },
  { value: 'ETB', label: 'ETB' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
];

const goalIcons = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '💍', '🎓', '🏥', '🎉'];

const colors = [
  '#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6', 
  '#ec4899', '#f59e0b', '#ef4444', '#6366f1'
];

export default function SavingsGoalForm({ onSuccess }: SavingsGoalFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(goalIcons[0]);
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      currency: 'KES',
      current_amount: '0',
    },
  });

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
        <Button size="sm">
          <Plus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create Savings Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {goalIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-10 h-10 rounded-lg border-2 text-xl transition-all flex items-center justify-center ${
                    selectedIcon === icon ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Goal Name</Label>
            <Input
              id="name"
              placeholder="e.g., Emergency Fund, New Car"
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_amount">Target Amount</Label>
              <Input
                id="target_amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('target_amount')}
              />
              {errors.target_amount && <p className="text-xs text-destructive">{errors.target_amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select 
                defaultValue="KES" 
                onValueChange={(value) => setValue('currency', value as CurrencyCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.value} value={curr.value}>
                      {curr.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_amount">Already Saved</Label>
              <Input
                id="current_amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('current_amount')}
              />
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
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === color ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
