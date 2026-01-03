import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import { Plus, Wand2, Trash2, Loader2 } from 'lucide-react';
import type { Category } from '@/types/finance';

interface TransactionRule {
  id: string;
  user_id: string;
  name: string;
  description_pattern: string;
  category_id?: string;
  tags?: string[];
  is_active?: boolean;
  created_at: string;
}

const ruleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description_pattern: z.string().min(1, 'Pattern is required').max(200),
  category_id: z.string().optional(),
});

type RuleFormData = z.infer<typeof ruleSchema>;

interface TransactionRulesManagerProps {
  categories: Category[];
  onRulesChange: () => void;
}

export default function TransactionRulesManager({ categories, onRulesChange }: TransactionRulesManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<TransactionRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('transaction_rules')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoadingRules(false);
    }
  };

  const onSubmit = async (data: RuleFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('transaction_rules').insert({
        user_id: userData.user.id,
        name: data.name,
        description_pattern: data.description_pattern,
        category_id: data.category_id || null,
      });

      if (error) throw error;
      toast.success('Rule created successfully');
      reset();
      setOpen(false);
      loadRules();
      onRulesChange();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('transaction_rules')
        .update({ is_active: !isActive })
        .eq('id', ruleId);

      if (error) throw error;
      toast.success(isActive ? 'Rule disabled' : 'Rule enabled');
      loadRules();
      onRulesChange();
    } catch (error: any) {
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('transaction_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      toast.success('Rule deleted');
      loadRules();
      onRulesChange();
    } catch (error: any) {
      toast.error('Failed to delete rule');
    }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Auto-Categorization Rules
            </CardTitle>
            <CardDescription>
              Automatically categorize transactions based on description patterns
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Auto-Categorization Rule</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input
                    placeholder="e.g., Grocery Stores"
                    {...register('name')}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Description Pattern</Label>
                  <Input
                    placeholder="e.g., supermarket, grocery, shoprite"
                    {...register('description_pattern')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated keywords to match in transaction descriptions
                  </p>
                  {errors.description_pattern && (
                    <p className="text-xs text-destructive">{errors.description_pattern.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Assign Category</Label>
                  <Select onValueChange={(value) => setValue('category_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Rule
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loadingRules ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No rules created yet</p>
            <p className="text-sm">Create rules to auto-categorize your transactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const category = categories.find(c => c.id === rule.category_id);
              return (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    rule.is_active ? 'bg-muted/50' : 'bg-muted/20 opacity-60'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      {category && (
                        <span className="text-sm px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {category.icon} {category.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pattern: <code className="bg-background px-1 rounded">{rule.description_pattern}</code>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.is_active ?? true}
                      onCheckedChange={() => handleToggleRule(rule.id, rule.is_active ?? true)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
