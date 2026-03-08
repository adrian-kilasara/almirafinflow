import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff, Archive, Loader2, TrendingUp, TrendingDown, Bell } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Account, Transaction } from '@/types/finance';

const editSchema = z.object({
  name: z.string().min(1).max(100),
  institution_name: z.string().max(100).optional(),
  account_number: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  min_balance_alert: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

interface AccountCardProps {
  account: Account;
  transactions?: Transaction[];
  onRefresh: () => void;
  onSelect?: (account: Account) => void;
}

export default function AccountCard({ account, transactions = [], onRefresh, onSelect }: AccountCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: account.name,
      institution_name: account.institution_name || '',
      account_number: account.account_number || '',
      notes: account.notes || '',
      min_balance_alert: account.min_balance_alert != null ? String(account.min_balance_alert) : '',
    },
  });

  // Calculate 30-day stats from transactions
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];

  const acctTxns = transactions.filter(t => t.account_id === account.id);
  const last30 = acctTxns.filter(t => t.date >= d30);
  const last7 = acctTxns.filter(t => t.date >= d7);

  const calcFlow = (txns: Transaction[]) => {
    const inflow = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const outflow = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    return { inflow, outflow, net: inflow - outflow };
  };

  const flow30 = calcFlow(last30);
  const flow7 = calcFlow(last7);

  const isLowBalance = account.min_balance_alert != null && Number(account.balance) < Number(account.min_balance_alert);
  const isLiability = (account as any).classification === 'liability';

  const logAudit = async (action: string, fieldChanged?: string, oldVal?: string, newVal?: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from('account_audit_log' as any).insert({
      account_id: account.id,
      user_id: userData.user.id,
      action,
      field_changed: fieldChanged || null,
      old_value: oldVal || null,
      new_value: newVal || null,
      balance_before: account.balance,
      balance_after: account.balance,
    } as any);
  };

  const handleEdit = async (data: EditFormData) => {
    setLoading(true);
    try {
      const updates: Record<string, any> = { name: data.name };
      if (data.institution_name !== undefined) updates.institution_name = data.institution_name || null;
      if (data.account_number !== undefined) updates.account_number = data.account_number || null;
      if (data.notes !== undefined) updates.notes = data.notes || null;
      updates.min_balance_alert = data.min_balance_alert ? Number(data.min_balance_alert) : null;

      const { error } = await supabase.from('accounts').update(updates).eq('id', account.id);
      if (error) throw error;

      await logAudit('edit', 'name', account.name, data.name);
      toast.success('Account updated');
      setEditOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    try {
      const archived = !(account as any).is_archived;
      await supabase.from('accounts').update({ is_archived: archived } as any).eq('id', account.id);
      await logAudit(archived ? 'archive' : 'unarchive');
      toast.success(archived ? 'Account archived' : 'Account restored');
      onRefresh();
    } catch { toast.error('Failed'); }
  };

  const handleToggleActive = async () => {
    try {
      await supabase.from('accounts').update({ is_active: !account.is_active }).eq('id', account.id);
      await logAudit(account.is_active ? 'deactivate' : 'activate');
      toast.success(account.is_active ? 'Account frozen' : 'Account activated');
      onRefresh();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await supabase.from('accounts').update({ is_active: false, is_archived: true } as any).eq('id', account.id);
      await logAudit('soft_delete');
      toast.success('Account removed (data preserved)');
      onRefresh();
    } catch { toast.error('Failed to delete'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <Card
        className={`transition-all cursor-pointer hover:border-primary/50 ${
          !account.is_active ? 'opacity-50' : ''
        } ${isLowBalance ? 'border-[hsl(var(--warning))]/50' : ''}`}
        onClick={() => onSelect?.(account)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: (account.color || '#14b8a6') + '20' }}
              >
                {account.icon || '💳'}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{account.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">
                  {account.type.replace('_', ' ')}
                  {account.institution_name && ` · ${account.institution_name}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="text-right mr-1">
                <p className={`font-mono font-semibold text-base ${isLiability ? 'text-expense' : ''}`}>
                  {isLiability ? '-' : ''}{formatCurrency(Math.abs(Number(account.balance)), account.currency)}
                </p>
                <div className="flex items-center justify-end gap-1">
                  {flow7.net !== 0 && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${flow7.net >= 0 ? 'text-income' : 'text-expense'}`}>
                      {flow7.net >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      7d
                    </span>
                  )}
                  {isLowBalance && <Bell className="w-3 h-3 text-[hsl(var(--warning))]" />}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(); }}>
                    {account.is_active ? <><EyeOff className="w-4 h-4 mr-2" /> Freeze</> : <><Eye className="w-4 h-4 mr-2" /> Activate</>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(); }}>
                    <Archive className="w-4 h-4 mr-2" /> {(account as any).is_archived ? 'Unarchive' : 'Archive'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                        <AlertDialogDescription>This archives the account and preserves transaction history.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mini stats row */}
          {last30.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
              <div>
                <p className="text-[10px] text-muted-foreground">30d In</p>
                <p className="text-xs font-mono text-income">{formatCurrency(flow30.inflow, account.currency)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">30d Out</p>
                <p className="text-xs font-mono text-expense">{formatCurrency(flow30.outflow, account.currency)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Net</p>
                <p className={`text-xs font-mono ${flow30.net >= 0 ? 'text-income' : 'text-expense'}`}>
                  {flow30.net >= 0 ? '+' : ''}{formatCurrency(flow30.net, account.currency)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Institution</Label>
                <Input {...register('institution_name')} placeholder="e.g., NMB" />
              </div>
              <div className="space-y-2">
                <Label>Account # (last 4)</Label>
                <Input {...register('account_number')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Min Balance Alert</Label>
              <Input type="number" step="0.01" {...register('min_balance_alert')} placeholder="Leave empty to disable" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} {...register('notes')} />
            </div>
            <p className="text-xs text-muted-foreground">
              Balance is auto-calculated from transactions. Manual editing is disabled for data integrity.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
