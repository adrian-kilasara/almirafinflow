import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  MoreHorizontal, Pencil, Trash2, Plus, CheckCircle, Loader2,
  TrendingUp, Calendar, History, ArrowDownLeft, Trophy, Clock,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { emitSavingsEvent, emitSavingsWithdrawEvent } from '@/lib/events';
import { differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import type { SavingsGoal, Account } from '@/types/finance';

const editSchema = z.object({
  name: z.string().min(1).max(100),
  target_amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  target_date: z.string().optional(),
});

const addFundsSchema = z.object({
  amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  account_id: z.string().min(1, 'Select an account'),
  notes: z.string().optional(),
});

const withdrawSchema = z.object({
  amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  account_id: z.string().min(1, 'Select destination account'),
  notes: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;
type AddFundsFormData = z.infer<typeof addFundsSchema>;
type WithdrawFormData = z.infer<typeof withdrawSchema>;

interface SavingsGoalCardProps {
  goal: SavingsGoal;
  onRefresh: () => void;
  index?: number;
}

export default function SavingsGoalCard({ goal, onRefresh, index = 0 }: SavingsGoalCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').eq('is_active', true).order('name');
    if (data) setAccounts(data as Account[]);
  };

  const fetchAllocations = async () => {
    const { data } = await supabase
      .from('savings_allocations').select('*')
      .eq('savings_goal_id', goal.id)
      .order('created_at', { ascending: false });
    if (data) setAllocations(data);
  };

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: goal.name, target_amount: String(goal.target_amount), target_date: goal.target_date || '' },
  });

  const addFundsForm = useForm<AddFundsFormData>({
    resolver: zodResolver(addFundsSchema),
    defaultValues: { amount: '', account_id: '', notes: '' },
  });

  const withdrawForm = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: '', account_id: '', notes: '' },
  });

  const percentage = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
  const remaining = Math.max(Number(goal.target_amount) - Number(goal.current_amount), 0);
  const daysLeft = goal.target_date ? differenceInDays(new Date(goal.target_date), new Date()) : null;
  const milestones = [25, 50, 75, 100];

  const forecast = useMemo(() => {
    if (goal.is_completed || Number(goal.current_amount) <= 0) return null;
    const createdAt = new Date(goal.created_at);
    const now = new Date();
    const daysSinceCreation = Math.max(differenceInDays(now, createdAt), 1);
    const dailyRate = Number(goal.current_amount) / daysSinceCreation;
    if (dailyRate <= 0) return null;
    const daysToComplete = remaining / dailyRate;
    const estimatedDate = new Date(now.getTime() + daysToComplete * 86400000);
    return { dailyRate, daysToComplete: Math.ceil(daysToComplete), estimatedDate };
  }, [goal, remaining]);

  // Ring gauge
  const ringR = 28;
  const ringC = 2 * Math.PI * ringR;
  const ringO = ringC - (ringC * Math.min(percentage, 100)) / 100;
  const goalColor = goal.color || 'hsl(var(--primary))';
  const isHex = goalColor.startsWith('#');

  // === Handlers (same logic, unchanged) ===
  const handleEdit = async (data: EditFormData) => {
    setLoading(true);
    try {
      const newTarget = Number(data.target_amount);
      const { error } = await supabase.from('savings_goals').update({
        name: data.name, target_amount: newTarget, target_date: data.target_date || null,
        is_completed: Number(goal.current_amount) >= newTarget,
      }).eq('id', goal.id);
      if (error) throw error;
      toast.success('Goal updated'); setEditOpen(false); onRefresh();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleAddFunds = async (data: AddFundsFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const amount = Number(data.amount);
      const account = accounts.find(a => a.id === data.account_id);
      if (!account) throw new Error('Account not found');
      if (Number(account.balance) < amount) throw new Error('Insufficient balance');
      const { error: allocError } = await supabase.from('savings_allocations').insert({
        user_id: userData.user.id, savings_goal_id: goal.id, account_id: data.account_id,
        amount, currency: goal.currency, notes: data.notes || null,
      });
      if (allocError) throw allocError;
      await supabase.from('accounts').update({ balance: Number(account.balance) - amount }).eq('id', data.account_id);
      const newAmount = Number(goal.current_amount) + amount;
      if (newAmount >= Number(goal.target_amount)) {
        await supabase.from('savings_goals').update({ is_completed: true }).eq('id', goal.id);
        toast.success('🎉 Goal completed!');
      } else {
        const oldPct = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
        const newPct = (newAmount / Number(goal.target_amount)) * 100;
        const milestone = milestones.find(m => oldPct < m && newPct >= m);
        if (milestone) toast.success(`🏆 ${milestone}% milestone reached!`);
        else toast.success('Funds allocated!');
      }
      await emitSavingsEvent(userData.user.id, goal.name, amount, newAmount, Number(goal.target_amount), goal.id);
      setAddFundsOpen(false); addFundsForm.reset(); onRefresh();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleWithdraw = async (data: WithdrawFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const amount = Number(data.amount);
      if (amount > Number(goal.current_amount)) throw new Error('Cannot withdraw more than saved');
      const account = accounts.find(a => a.id === data.account_id);
      if (!account) throw new Error('Account not found');
      const { error: allocError } = await supabase.from('savings_allocations').insert({
        user_id: userData.user.id, savings_goal_id: goal.id, account_id: data.account_id,
        amount: -amount, currency: goal.currency, notes: data.notes || `Withdrawal to ${account.name}`,
      });
      if (allocError) throw allocError;
      await supabase.from('accounts').update({ balance: Number(account.balance) + amount }).eq('id', data.account_id);
      const newCurrent = Number(goal.current_amount) - amount;
      if (goal.is_completed && newCurrent < Number(goal.target_amount)) {
        await supabase.from('savings_goals').update({ is_completed: false }).eq('id', goal.id);
      }
      toast.success('Funds withdrawn'); setWithdrawOpen(false); withdrawForm.reset(); onRefresh();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { data: allocs } = await supabase.from('savings_allocations').select('*').eq('savings_goal_id', goal.id);
      if (allocs && allocs.length > 0) {
        for (const alloc of allocs) {
          if (Number(alloc.amount) > 0) {
            const acc = accounts.find(a => a.id === alloc.account_id);
            if (acc) await supabase.from('accounts').update({ balance: Number(acc.balance) + Number(alloc.amount) }).eq('id', alloc.account_id);
          }
        }
        await supabase.from('savings_allocations').delete().eq('savings_goal_id', goal.id);
      }
      const { error } = await supabase.from('savings_goals').delete().eq('id', goal.id);
      if (error) throw error;
      toast.success('Goal deleted, funds returned'); onRefresh();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="overflow-hidden relative group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          {/* Ambient glow */}
          <div
            className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: isHex ? goalColor + '30' : undefined, backgroundColor: !isHex ? 'hsl(var(--primary) / 0.12)' : undefined }}
          />

          <CardContent className="p-5 relative z-10">
            <div className="flex gap-4">
              {/* Ring Gauge */}
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r={ringR} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                  <motion.circle
                    cx="32" cy="32" r={ringR}
                    fill="none"
                    stroke={goal.is_completed ? 'hsl(var(--income))' : (isHex ? goalColor : 'hsl(var(--primary))')}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={ringC}
                    initial={{ strokeDashoffset: ringC }}
                    animate={{ strokeDashoffset: ringO }}
                    transition={{ duration: 0.9, delay: index * 0.07 + 0.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg">{goal.icon || '🎯'}</span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm truncate">{goal.name}</h3>
                      {goal.is_completed && <CheckCircle className="w-3.5 h-3.5 text-income shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {goal.target_date && (
                        <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                          daysLeft !== null && daysLeft < 0 ? 'text-destructive' : daysLeft !== null && daysLeft < 30 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'
                        }`}>
                          <Calendar className="w-2.5 h-2.5" />
                          {daysLeft !== null && daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Due today' : 'Past due'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setAddFundsOpen(true)} disabled={!!goal.is_completed}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setWithdrawOpen(true)}><ArrowDownLeft className="w-4 h-4 mr-2" /> Withdraw</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { fetchAllocations(); setHistoryOpen(true); }}><History className="w-4 h-4 mr-2" /> History</DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
                              <AlertDialogDescription>All allocations will be refunded to source accounts.</AlertDialogDescription>
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

                {/* Amount Row */}
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-base font-black font-mono">{formatCurrency(Number(goal.current_amount), goal.currency)}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">/ {formatCurrency(Number(goal.target_amount), goal.currency)}</span>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5 space-y-1.5">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: goal.is_completed ? 'hsl(var(--income))' : (isHex ? goalColor : 'hsl(var(--primary))') }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(percentage, 100)}%` }}
                      transition={{ duration: 0.8, delay: index * 0.07 + 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground">{percentage.toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{formatCurrency(remaining, goal.currency)} to go</span>
                  </div>
                </div>

                {/* Milestones */}
                <div className="flex gap-1 mt-2">
                  {milestones.map(m => (
                    <motion.div
                      key={m}
                      className={`flex-1 h-1 rounded-full ${percentage >= m ? 'bg-primary' : 'bg-muted'}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: index * 0.07 + 0.4 + (m / 100) * 0.3, duration: 0.3 }}
                      style={{ transformOrigin: 'left' }}
                      title={`${m}%`}
                    />
                  ))}
                </div>

                {/* Forecast */}
                {forecast && !goal.is_completed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-2.5 py-1.5 mt-2.5"
                  >
                    <TrendingUp className="w-3 h-3 text-primary shrink-0" />
                    {formatCurrency(Math.round(forecast.dailyRate * 30), goal.currency)}/mo → {forecast.daysToComplete < 365 ? `${Math.ceil(forecast.daysToComplete / 30)}mo` : `${(forecast.daysToComplete / 365).toFixed(1)}yr`}
                  </motion.div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Goal</DialogTitle></DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2"><Label>Goal Name</Label><Input {...editForm.register('name')} /></div>
            <div className="space-y-2"><Label>Target Amount</Label><Input type="number" step="0.01" {...editForm.register('target_amount')} /></div>
            <div className="space-y-2"><Label>Target Date</Label><Input type="date" {...editForm.register('target_date')} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Funds Dialog */}
      <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Funds to {goal.name}</DialogTitle></DialogHeader>
          <form onSubmit={addFundsForm.handleSubmit(handleAddFunds)} className="space-y-4">
            <div className="space-y-2">
              <Label>From Account</Label>
              <Select onValueChange={(v) => addFundsForm.setValue('account_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(Number(a.balance), a.currency)})</SelectItem>))}
                </SelectContent>
              </Select>
              {addFundsForm.formState.errors.account_id && <p className="text-xs text-destructive">{addFundsForm.formState.errors.account_id.message}</p>}
            </div>
            <div className="space-y-2"><Label>Amount ({goal.currency})</Label><Input type="number" step="0.01" placeholder="0.00" {...addFundsForm.register('amount')} /></div>
            <div className="space-y-2"><Label>Notes (optional)</Label><Textarea rows={2} {...addFundsForm.register('notes')} /></div>
            <p className="text-xs text-muted-foreground">Need: {formatCurrency(remaining, goal.currency)} more</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddFundsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Allocate</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Withdraw from {goal.name}</DialogTitle></DialogHeader>
          <form onSubmit={withdrawForm.handleSubmit(handleWithdraw)} className="space-y-4">
            <div className="space-y-2">
              <Label>To Account</Label>
              <Select onValueChange={(v) => withdrawForm.setValue('account_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({goal.currency})</Label>
              <Input type="number" step="0.01" max={Number(goal.current_amount)} placeholder="0.00" {...withdrawForm.register('amount')} />
              <p className="text-xs text-muted-foreground">Available: {formatCurrency(Number(goal.current_amount), goal.currency)}</p>
            </div>
            <div className="space-y-2"><Label>Notes (optional)</Label><Textarea rows={2} {...withdrawForm.register('notes')} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} variant="destructive">{loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Withdraw</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Allocation History — {goal.name}</DialogTitle></DialogHeader>
          {allocations.length > 0 ? (
            <div className="space-y-2">
              {allocations.map((a, i) => {
                const acc = accounts.find(ac => ac.id === a.account_id);
                const isDeposit = Number(a.amount) > 0;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40"
                  >
                    <div>
                      <p className="text-sm font-semibold">{isDeposit ? 'Deposit' : 'Withdrawal'}</p>
                      <p className="text-[10px] text-muted-foreground">{acc?.name || 'Unknown'} • {formatDate(a.created_at)}</p>
                      {a.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{a.notes}</p>}
                    </div>
                    <span className={`font-mono text-sm font-bold ${isDeposit ? 'text-income' : 'text-destructive'}`}>
                      {isDeposit ? '+' : ''}{formatCurrency(Number(a.amount), goal.currency)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No allocations yet</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
