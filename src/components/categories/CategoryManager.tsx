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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Settings, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
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
    defaultValues: {
      type: 'expense',
    },
  });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

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
        // Update existing category
        const { error } = await supabase
          .from('categories')
          .update({
            name: data.name,
            type: data.type,
            icon: selectedIcon,
            color: selectedColor,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Category updated!');
      } else {
        // Create new category
        const { error } = await supabase.from('categories').insert({
          user_id: userData.user.id,
          name: data.name,
          type: data.type,
          icon: selectedIcon,
          color: selectedColor,
        });

        if (error) throw error;
        toast.success('Category created!');
      }

      resetForm();
      fetchCategories();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      toast.success('Category deleted');
      fetchCategories();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === activeTab);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Categories
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as TransactionType);
          resetForm();
        }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
          </TabsList>

          {['expense', 'income', 'transfer'].map((type) => (
            <TabsContent key={type} value={type} className="space-y-4 mt-4">
              {isCreating ? (
                <Card>
                  <CardContent className="p-4">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">
                          {editingCategory ? 'Edit Category' : 'New Category'}
                        </h4>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={resetForm}
                        >
                          Cancel
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {categoryIcons.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => setSelectedIcon(icon)}
                              className={`w-9 h-9 rounded-lg border-2 text-lg transition-all flex items-center justify-center ${
                                selectedIcon === icon ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                              }`}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="name">Category Name</Label>
                        <Input
                          id="name"
                          placeholder="e.g., Food, Transport"
                          {...register('name')}
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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

                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {editingCategory ? 'Save Changes' : 'Create Category'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Button onClick={startCreate} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add {type.charAt(0).toUpperCase() + type.slice(1)} Category
                  </Button>

                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredCategories.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No {type} categories yet
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {filteredCategories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                              style={{ backgroundColor: `${category.color}20` }}
                            >
                              {category.icon}
                            </span>
                            <div>
                              <p className="font-medium">{category.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{category.type}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEdit(category)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
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
                                  <AlertDialogAction 
                                    onClick={() => handleDelete(category.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
