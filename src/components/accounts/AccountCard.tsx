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
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff, Archive, Loader2, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
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
  const isLiability = account.classification === 'liability';

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
      const archived = !account.is_archived;
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

  // Sparkline: 7-day net flow
  const sparkData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() - (6 - i) * 86400000).toISOString().split('T')[0];
    const dayTxns = acctTxns.filter(t => t.date === date);
    return dayTxns.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  });
  const sparkMax = Math.max(...sparkData.map(Math.abs), 1);

  // SVG sparkline path
  const sparkPoints = sparkData.map((val, i) => {
    const x = (i / 6) * 100;
    const y = 50 - (val / sparkMax) * 40;
    return `${x},${y}`;
  });
  const sparkLinePath = `M ${sparkPoints.join(' L ')}`;
  const sparkAreaPath = `${sparkLinePath} L 100,50 L 0,50 Z`;

  const accentColor = account.color || 'hsl(var(--primary))';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.25, ease: 'easeOut' } }}
        layout
      >
        <div
          className={`group relative overflow-hidden rounded-2xl border cursor-pointer transition-all duration-500 bg-card ${
            !account.is_active ? 'opacity-40 grayscale' : ''
          } ${isLowBalance
            ? 'border-[hsl(var(--warning))]/50 shadow-[0_0_30px_-8px_hsl(var(--warning)/0.2)]'
            : 'border-border/40 hover:border-primary/40 hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.2)]'
          }`}
          onClick={() => onSelect?.(account)}
        >
          {/* Ambient gradient overlay */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 80% 20%, ${accentColor}12, transparent 70%)`,
            }}
          />

          {/* Top accent line */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 0.4, scaleX: 1 }}
            transition={{ delay: index * 0.07 + 0.3, duration: 0.6 }}
          />

          <div className="relative p-4 pb-3">
            {/* Header: Icon + Name + Menu */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, -5, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`,
                    border: `1px solid ${accentColor}25`,
                    boxShadow: `0 4px 16px ${accentColor}15`,
                  }}
                >
                  {account.icon || '💳'}
                  {isLowBalance && (
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[hsl(var(--warning))] border-2 border-card shadow-[0_0_8px_hsl(var(--warning)/0.5)]"
                    />
                  )}
                </motion.div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors duration-300">
                    {account.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                      isLiability ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income'
                    }`}>
                      {isLiability ? '↓' : '↑'} {isLiability ? 'Liability' : 'Asset'}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {account.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-muted/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(); }}>
                    {account.is_active ? <><EyeOff className="w-4 h-4 mr-2" /> Freeze</> : <><Eye className="w-4 h-4 mr-2" /> Activate</>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(); }}>
                    <Archive className="w-4 h-4 mr-2" /> {account.is_archived ? 'Unarchive' : 'Archive'}
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

            {/* Balance */}
            <div className="mb-3">
              <motion.p
                className={`font-mono font-extrabold text-2xl tracking-tight leading-none ${isLiability ? 'text-expense' : ''}`}
                key={String(account.balance)}
                initial={{ opacity: 0.4, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                {isLiability ? '-' : ''}{formatCurrency(Math.abs(Number(account.balance)), account.currency)}
              </motion.p>
              <div className="flex items-center gap-2.5 mt-1.5">
                {flow7.net !== 0 && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.07 + 0.4 }}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${flow7.net >= 0 ? 'text-income' : 'text-expense'}`}
                  >
                    {flow7.net >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {flow7.net >= 0 ? '+' : ''}{formatCurrency(Math.abs(flow7.net), account.currency)}
                    <span className="text-[9px] text-muted-foreground font-normal">7d</span>
                  </motion.span>
                )}
                {account.institution_name && (
                  <span className="text-[10px] text-muted-foreground">
                    · {account.institution_name}
                  </span>
                )}
              </div>
            </div>

            {/* SVG Sparkline */}
            {last30.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.07 + 0.5 }}
                className="mb-3"
              >
                <svg viewBox="0 0 100 50" className="w-full h-10" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`sparkGrad-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={flow30.net >= 0 ? 'hsl(var(--income))' : 'hsl(var(--expense))'} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={flow30.net >= 0 ? 'hsl(var(--income))' : 'hsl(var(--expense))'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <motion.path
                    d={sparkAreaPath}
                    fill={`url(#sparkGrad-${account.id})`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.07 + 0.6, duration: 0.5 }}
                  />
                  <motion.path
                    d={sparkLinePath}
                    fill="none"
                    stroke={flow30.net >= 0 ? 'hsl(var(--income))' : 'hsl(var(--expense))'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: index * 0.07 + 0.5, duration: 0.8, ease: 'easeOut' }}
                  />
                </svg>
              </motion.div>
            )}

            {/* Flow stats row */}
            {last30.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 + 0.6 }}
                className="grid grid-cols-3 gap-1"
              >
                {[
                  { label: 'Money In', value: flow30.inflow, color: 'text-income' },
                  { label: 'Money Out', value: flow30.outflow, color: 'text-expense' },
                  { label: 'Net Result', value: flow30.net, color: flow30.net >= 0 ? 'text-income' : 'text-expense' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="text-center px-1.5 py-1.5 rounded-xl bg-muted/30 min-w-0"
                    title={stat.label === 'Net Result'
                      ? (stat.value >= 0 ? 'Gain — earned more than spent (last 30d)' : 'Loss — spent more than earned (last 30d)')
                      : `${stat.label} this month`}
                  >
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-medium truncate">{stat.label}</p>
                    <p className={`text-[11px] font-mono font-bold truncate ${stat.color}`}>
                      {stat.label === 'Net Result' && stat.value >= 0 ? '+' : ''}{formatCurrency(Math.abs(stat.value), account.currency)}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Bottom meta */}
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/20">
              <div className="flex items-center gap-1.5">
                {last30.length > 0 ? (
                  <>
                    <Zap className="w-2.5 h-2.5 text-primary/60" />
                    <p className="text-[9px] text-muted-foreground font-medium">{last30.length} txns · 30d</p>
                  </>
                ) : (
                  <>
                    <Activity className="w-2.5 h-2.5 text-muted-foreground/40" />
                    <p className="text-[9px] text-muted-foreground">No recent activity</p>
                  </>
                )}
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.07 + 0.7 }}
                className="text-[9px] text-muted-foreground/60 font-mono"
              >
                {account.currency}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">{account.icon || '💳'}</span>
              Edit Account
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...register('name')} className="rounded-xl" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Institution</Label>
                <Input {...register('institution_name')} placeholder="e.g., NMB" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Account # (last 4)</Label>
                <Input {...register('account_number')} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Min Balance Alert</Label>
              <Input type="number" step="0.01" {...register('min_balance_alert')} placeholder="Leave empty to disable" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} {...register('notes')} className="rounded-xl" />
            </div>
            <p className="text-xs text-muted-foreground">
              Balance is auto-calculated from transactions.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={loading} className="rounded-xl">
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
