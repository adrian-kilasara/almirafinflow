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
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff, Archive, Loader2, TrendingUp, TrendingDown, Bell, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { motion } from 'framer-motion';
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
  index?: number;
}

export default function AccountCard({ account, transactions = [], onRefresh, onSelect, index = 0 }: AccountCardProps) {
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
      account_id: account.id, user_id: userData.user.id, action,
      field_changed: fieldChanged || null, old_value: oldVal || null, new_value: newVal || null,
      balance_before: account.balance, balance_after: account.balance,
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
    } finally { setLoading(false); }
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

  // Mini sparkline data (last 7 days net flow per day)
  const sparkData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() - (6 - i) * 86400000).toISOString().split('T')[0];
    const dayTxns = acctTxns.filter(t => t.date === date);
    const net = dayTxns.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
    return net;
  });
  const sparkMax = Math.max(...sparkData.map(Math.abs), 1);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        layout
      >
        <Card
          className={`group relative overflow-hidden cursor-pointer transition-all duration-300 ${
            !account.is_active ? 'opacity-50 grayscale' : ''
          } ${isLowBalance ? 'border-[hsl(var(--warning))]/40 shadow-[0_0_20px_-5px_hsl(var(--warning)/0.15)]' : 'hover:border-primary/30 hover:shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.15)]'}`}
          onClick={() => onSelect?.(account)}
        >
          {/* Ambient glow */}
          <div 
            className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ backgroundColor: account.color || 'hsl(var(--primary))' }}
          />
          
          <CardContent className="relative p-4">
            {/* Top row: Icon + Name + Balance + Menu */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <motion.div
                  whileHover={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 0.4 }}
                  className="relative w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 border border-border/50"
                  style={{ 
                    backgroundColor: (account.color || '#14b8a6') + '15',
                    boxShadow: `0 4px 12px ${(account.color || '#14b8a6')}20`
                  }}
                >
                  {account.icon || '💳'}
                  {isLowBalance && (
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[hsl(var(--warning))] border-2 border-card"
                    />
                  )}
                </motion.div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{account.name}</h3>
                  <p className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                    {account.type.replace('_', ' ')}
                    {account.institution_name && (
                      <><span className="text-border">·</span> {account.institution_name}</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <motion.p 
                    className={`font-mono font-bold text-base tracking-tight ${isLiability ? 'text-expense' : ''}`}
                    key={String(account.balance)}
                    initial={{ opacity: 0.5, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {isLiability ? '-' : ''}{formatCurrency(Math.abs(Number(account.balance)), account.currency)}
                  </motion.p>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    {flow7.net !== 0 && (
                      <span className={`text-[10px] flex items-center gap-0.5 font-medium ${flow7.net >= 0 ? 'text-income' : 'text-expense'}`}>
                        {flow7.net >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {flow7.net >= 0 ? '+' : ''}{formatCurrency(Math.abs(flow7.net), account.currency)}
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
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

            {/* Mini sparkline + stats */}
            {last30.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.06 + 0.3 }}
                className="mt-3 pt-3 border-t border-border/30"
              >
                {/* 7-day sparkline */}
                <div className="flex items-end gap-[3px] h-6 mb-2">
                  {sparkData.map((val, i) => (
                    <motion.div
                      key={i}
                      className={`flex-1 rounded-sm ${val >= 0 ? 'bg-income/60' : 'bg-expense/60'}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max((Math.abs(val) / sparkMax) * 100, 8)}%` }}
                      transition={{ delay: index * 0.06 + 0.4 + i * 0.03, duration: 0.3 }}
                    />
                  ))}
                </div>
                
                {/* Flow stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">In</p>
                    <p className="text-[11px] font-mono font-semibold text-income">{formatCurrency(flow30.inflow, account.currency)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Out</p>
                    <p className="text-[11px] font-mono font-semibold text-expense">{formatCurrency(flow30.outflow, account.currency)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Net</p>
                    <p className={`text-[11px] font-mono font-semibold ${flow30.net >= 0 ? 'text-income' : 'text-expense'}`}>
                      {flow30.net >= 0 ? '+' : ''}{formatCurrency(flow30.net, account.currency)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Activity indicator */}
            {last30.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <Activity className="w-2.5 h-2.5 text-muted-foreground/50" />
                <p className="text-[9px] text-muted-foreground">{last30.length} transactions in 30d</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

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
