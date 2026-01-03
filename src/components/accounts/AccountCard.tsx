import { useState } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Account } from '@/types/finance';

const editSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  balance: z.string().refine(val => !isNaN(Number(val)), 'Must be a valid number'),
});

type EditFormData = z.infer<typeof editSchema>;

interface AccountCardProps {
  account: Account;
  onRefresh: () => void;
}

export default function AccountCard({ account, onRefresh }: AccountCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: account.name,
      balance: String(account.balance),
    },
  });

  const handleEdit = async (data: EditFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({
          name: data.name,
          balance: Number(data.balance),
        })
        .eq('id', account.id);

      if (error) throw error;
      toast.success('Account updated successfully');
      setEditOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id);

      if (error) throw error;
      toast.success(account.is_active ? 'Account disabled' : 'Account enabled');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update account');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Soft delete - just set is_active to false
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', account.id);

      if (error) throw error;
      toast.success('Account removed (data preserved for audit)');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className={`${!account.is_active ? 'opacity-50' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: account.color || '#14b8a6' + '20' }}
              >
                {account.icon || '💳'}
              </div>
              <div>
                <h3 className="font-semibold">{account.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">{account.type.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right mr-2">
                <p className="font-mono font-semibold text-lg">
                  {formatCurrency(Number(account.balance), account.currency)}
                </p>
                <p className="text-xs text-muted-foreground">{account.currency}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleActive} disabled={toggling}>
                    {account.is_active ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Disable
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Enable
                      </>
                    )}
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will hide the account but preserve transaction history for auditing.
                          The account data will not be permanently deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Current Balance</Label>
              <Input type="number" step="0.01" {...register('balance')} />
              {errors.balance && <p className="text-xs text-destructive">{errors.balance.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
