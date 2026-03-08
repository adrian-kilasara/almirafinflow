import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Layers, Pencil, Trash2, Plus, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TransactionType, Category } from '@/types/finance';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  type: z.enum(['income', 'expense', 'transfer']),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryManagerProps {
  onSuccess?: () => void;
}

const categoryIcons = [
  '🍔', '🛒', '🏠', '🚗', '💡', '📱', '🎬', '🏥',
  '📚', '✈️', '💰', '💼', '🎁', '🏋️', '🛍️', '☕',
  '🎵', '🎮', '💊', '🔧', '📦', '🎓', '🏦', '💳'
];

const colors = [
  '#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f59e0b', '#ef4444', '#6366f1'
];

const typeConfig = [
  { value: 'expense' as TransactionType, label: 'Expense', emoji: '💸', color: 'text-expense', bg: 'bg-expense/10', border: 'border-expense/30' },
  { value: 'income' as TransactionType, label: 'Income', emoji: '💰', color: 'text-income', bg: 'bg-income/10', border: 'border-income/30' },
  { value: 'transfer' as TransactionType, label: 'Transfer', emoji: '🔄', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
];

export default function CategoryManager({ onSuccess }: CategoryManagerProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedIcon, setSelectedIcon] = useState(categoryIcons[0]);
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [activeTab, setActiveTab] = useState<TransactionType>('expense');
  const [isCreating, setIsCreating] = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { type: 'expense' },
  });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) fetchCategories(); }, [open]);

  const resetForm = () => {
    reset({ name: '', type: activeTab });
    setSelectedIcon(categoryIcons[0]);
    setSelectedColor(colors[0]);
    setEditingCategory(null);
    setIsCreating(false);
  };

  const startCreate = () => {
    resetForm();
    setValue('type', activeTab);
    setIsCreating(true);
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setIsCreating(true);
    setValue('name', category.name);
    setValue('type', category.type);
    setSelectedIcon(category.icon || categoryIcons[0]);
    setSelectedColor(category.color || colors[0]);
  };

  const onSubmit = async (data: CategoryFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      if (editingCategory) {
        const { error } = await supabase.from('categories').update({ name: data.name, type: data.type, icon: selectedIcon, color: selectedColor }).eq('id', editingCategory.id);
        if (error) throw error;
        toast.success('Category updated!');
      } else {
        const { error } = await supabase.from('categories').insert({ user_id: userData.user.id, name: data.name, type: data.type, icon: selectedIcon, color: selectedColor });
        if (error) throw error;
        toast.success('Category created!');
      }
      resetForm();
      fetchCategories();
      onSuccess?.();
    } catch (error: any) { toast.error(error.message || 'Failed to save category'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (categoryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', categoryId);
      if (error) throw error;
      toast.success('Category deleted');
      fetchCategories();
      onSuccess?.();
    } catch (error: any) { toast.error(error.message || 'Failed to delete category'); }
    finally { setLoading(false); }
  };

  const filteredCategories = categories.filter(c => c.type === activeTab);
  const activeConfig = typeConfig.find(t => t.value === activeTab)!;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/80">
          <Layers className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            Categories
          </DialogTitle>
        </DialogHeader>

        {/* Type Tabs */}
        <div className="px-5 pt-4">
          <div className="flex items-center p-1 rounded-xl bg-muted/50 border border-border/30">
            {typeConfig.map((type) => (
              <button
                key={type.value}
                onClick={() => { setActiveTab(type.value); resetForm(); }}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === type.value ? type.color : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {activeTab === type.value && (
                  <motion.div
                    layoutId="catTabBg"
                    className="absolute inset-0 bg-card border border-border/50 rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <span>{type.emoji}</span>
                  {type.label}
                  <span className="text-[10px] text-muted-foreground">
                    ({categories.filter(c => c.type === type.value).length})
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 min-h-[320px]">
          <AnimatePresence mode="wait">
            {isCreating ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-border/30">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <button onClick={resetForm} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Back
                      </button>
                      <span className="text-xs font-medium text-muted-foreground">
                        {editingCategory ? 'Edit Category' : 'New Category'}
                      </span>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      {/* Icon Picker */}
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Icon</Label>
                        <div className="grid grid-cols-8 gap-1.5">
                          {categoryIcons.map((icon, i) => (
                            <motion.button
                              key={icon}
                              type="button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.015 }}
                              onClick={() => setSelectedIcon(icon)}
                              className={`w-10 h-10 rounded-xl border-2 text-lg transition-all flex items-center justify-center ${
                                selectedIcon === icon
                                  ? 'border-primary bg-primary/10 shadow-[0_0_8px_hsl(var(--primary)/0.2)]'
                                  : 'border-border/50 hover:border-primary/30 bg-muted/30'
                              }`}
                            >
                              {icon}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</Label>
                        <Input placeholder="e.g., Food, Transport" {...register('name')} className="bg-muted/30 border-border/30" />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Color</Label>
                        <div className="flex gap-2">
                          {colors.map((color) => (
                            <motion.button
                              key={color}
                              type="button"
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSelectedColor(color)}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                selectedColor === color ? 'border-foreground scale-110 shadow-lg' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${selectedColor}20` }}>
                          {selectedIcon}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{register('name').name ? 'Preview' : 'Category Name'}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{activeTab}</p>
                        </div>
                      </div>

                      <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {editingCategory ? 'Save Changes' : 'Create Category'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <Button onClick={startCreate} variant="outline" className="w-full rounded-xl border-dashed gap-2">
                  <Plus className="w-4 h-4" />
                  Add {activeConfig.label} Category
                </Button>

                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
                      <span className="text-4xl">{activeConfig.emoji}</span>
                    </motion.div>
                    <p className="text-sm text-muted-foreground mt-3">No {activeTab} categories yet</p>
                    <p className="text-xs text-muted-foreground/60">Create one to organize your transactions</p>
                  </motion.div>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {filteredCategories.map((category, i) => (
                      <motion.div
                        key={category.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="group flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-border/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border border-border/20"
                            style={{ backgroundColor: `${category.color}15` }}
                          >
                            {category.icon}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{category.name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{category.type}</p>
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => startEdit(category)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{category.name}". Transactions using this category will no longer be categorized.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(category.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
