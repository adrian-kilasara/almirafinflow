import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/format';
import { todayInTz, dateKeyInTz, diffDaysKeys } from '@/lib/datetime';
import {
  Plus, CreditCard, Wifi, Tv, Music, Zap, Home, Car, Phone,
  MoreHorizontal, Trash2, Edit, CalendarClock, AlertTriangle,
  CheckCircle, Clock, TrendingUp, Receipt
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Account } from '@/types/finance';

interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  frequency: string;
  due_date: string | null;
  next_due_date: string | null;
  is_active: boolean;
  auto_pay: boolean;
  provider: string | null;
  icon: string | null;
  color: string | null;
  notes: string | null;
  last_paid_date: string | null;
  created_at: string;
  updated_at: string;
}

const BILL_CATEGORIES = [
  { value: 'rent', label: 'Rent / Housing', icon: Home, emoji: '🏠' },
  { value: 'utilities', label: 'Utilities', icon: Zap, emoji: '⚡' },
  { value: 'internet', label: 'Internet / WiFi', icon: Wifi, emoji: '📶' },
  { value: 'streaming', label: 'Streaming', icon: Tv, emoji: '📺' },
  { value: 'music', label: 'Music', icon: Music, emoji: '🎵' },
  { value: 'phone', label: 'Phone / Mobile', icon: Phone, emoji: '📱' },
  { value: 'transport', label: 'Transport', icon: Car, emoji: '🚗' },
  { value: 'insurance', label: 'Insurance', icon: CreditCard, emoji: '🛡️' },
  { value: 'loan', label: 'Loan Payment', icon: Receipt, emoji: '💳' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, emoji: '📦' },
];

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

interface BillsProps {
  accounts?: Account[];
  onTransactionCreated?: () => void;
}

export default function BillsSubscriptions({ accounts = [], onTransactionCreated }: BillsProps) {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming'>('all');

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [frequency, setFrequency] = useState('monthly');
  const [dueDate, setDueDate] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [autoPay, setAutoPay] = useState(false);
  const [provider, setProvider] = useState('');
  const [notes, setNotes] = useState('');
  const [payFromAccount, setPayFromAccount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) fetchBills(); }, [user]);

  const fetchBills = async () => {
    const { data } = await supabase
      .from('bills_subscriptions')
      .select('*')
      .order('next_due_date', { ascending: true });
    if (data) setBills(data as Bill[]);
    setLoading(false);
  };

  const resetForm = () => {
    setName(''); setAmount(''); setCategory('other'); setFrequency('monthly');
    setDueDate(''); setNextDueDate(''); setAutoPay(false); setProvider(''); setNotes('');
    setEditingBill(null);
  };

  const openEdit = (bill: Bill) => {
    setEditingBill(bill);
    setName(bill.name);
    setAmount(String(bill.amount));
    setCategory(bill.category);
    setFrequency(bill.frequency);
    setDueDate(bill.due_date || '');
    setNextDueDate(bill.next_due_date || '');
    setAutoPay(bill.auto_pay);
    setProvider(bill.provider || '');
    setNotes(bill.notes || '');
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !name.trim() || !amount) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        amount: parseFloat(amount),
        category,
        frequency,
        due_date: dueDate || null,
        next_due_date: nextDueDate || dueDate || null,
        auto_pay: autoPay,
        provider: provider.trim() || null,
        notes: notes.trim() || null,
      };

      if (editingBill) {
        await supabase.from('bills_subscriptions').update(payload).eq('id', editingBill.id);
        toast.success('Bill updated');
      } else {
        await supabase.from('bills_subscriptions').insert(payload);
        toast.success('Bill added');
      }
      resetForm();
      setFormOpen(false);
      fetchBills();
    } catch {
      toast.error('Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  const deleteBill = async (id: string) => {
    await supabase.from('bills_subscriptions').delete().eq('id', id);
    setBills(prev => prev.filter(b => b.id !== id));
    toast.success('Bill removed');
  };

  const markPaid = async (bill: Bill, sourceAccountId?: string) => {
    if (!user) return;
    const today = todayInTz();
    const nextDate = calculateNextDate(today, bill.frequency);

    // Determine source account: explicit pick > stored payFromAccount > first active
    const pickedId = sourceAccountId || payFromAccount;
    const targetAccount = pickedId
      ? accounts.find(a => a.id === pickedId)
      : accounts.find(a => a.is_active && !a.is_archived);

    if (!targetAccount) {
      toast.error('No account available — add an account first');
      return;
    }

    // Auto-map bill category to a real expense category (create once if missing)
    let categoryId: string | null = null;
    try {
      const { data: existingCats } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('type', 'expense');
      const catLabel = BILL_CATEGORIES.find(c => c.value === bill.category)?.label || 'Bills';
      const existing = (existingCats || []).find(c => c.name.toLowerCase() === catLabel.toLowerCase());
      if (existing) {
        categoryId = existing.id;
      } else {
        const { data: created } = await supabase
          .from('categories')
          .insert({ user_id: user.id, name: catLabel, type: 'expense', is_default: false, icon: '🧾' })
          .select('id')
          .single();
        categoryId = created?.id || null;
      }
    } catch {
      categoryId = null;
    }

    const { error: txError } = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: targetAccount.id,
      type: 'expense' as const,
      amount: Number(bill.amount),
      currency: targetAccount.currency,
      date: today,
      description: `${bill.name} — ${bill.frequency} payment`,
      merchant: bill.provider || bill.name,
      payment_method: bill.auto_pay ? 'auto_debit' : 'cash',
      status: 'completed',
      category_id: categoryId,
      tags: ['bill-payment', bill.category],
    });

    if (txError) {
      toast.error('Failed to record payment');
      return;
    }

    await supabase.from('accounts').update({
      balance: Number(targetAccount.balance) - Number(bill.amount),
    }).eq('id', targetAccount.id);

    await supabase.from('bills_subscriptions').update({
      last_paid_date: today,
      next_due_date: nextDate,
    }).eq('id', bill.id);

    onTransactionCreated?.();
    toast.success(`${bill.name} paid from ${targetAccount.name}`);
    fetchBills();
  };

  const calculateNextDate = (from: string, freq: string): string => {
    // Use noon UTC to avoid TZ drift when adding months/years
    const d = new Date(`${from}T12:00:00Z`);
    switch (freq) {
      case 'weekly': d.setUTCDate(d.getUTCDate() + 7); break;
      case 'biweekly': d.setUTCDate(d.getUTCDate() + 14); break;
      case 'monthly': d.setUTCMonth(d.getUTCMonth() + 1); break;
      case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break;
      case 'yearly': d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    }
    return d.toISOString().slice(0, 10);
  };

  const getDaysUntilDue = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return diffDaysKeys(dateStr, todayInTz());
  };

  const getDueStatus = (days: number | null) => {
    if (days === null) return { label: 'No date', color: 'text-muted-foreground', bg: 'bg-muted/30' };
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'text-expense', bg: 'bg-expense/10' };
    if (days === 0) return { label: 'Due today', color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10' };
    if (days <= 3) return { label: `${days}d left`, color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10' };
    if (days <= 7) return { label: `${days}d left`, color: 'text-primary', bg: 'bg-primary/10' };
    return { label: `${days}d left`, color: 'text-muted-foreground', bg: 'bg-muted/30' };
  };

  const getCatInfo = (cat: string) => BILL_CATEGORIES.find(c => c.value === cat) || BILL_CATEGORIES[BILL_CATEGORIES.length - 1];

  // Summary stats
  const summary = useMemo(() => {
    const active = bills.filter(b => b.is_active);
    const monthly = active.reduce((sum, b) => {
      const amt = Number(b.amount);
      switch (b.frequency) {
        case 'weekly': return sum + amt * 4.33;
        case 'biweekly': return sum + amt * 2.17;
        case 'monthly': return sum + amt;
        case 'quarterly': return sum + amt / 3;
        case 'yearly': return sum + amt / 12;
        default: return sum + amt;
      }
    }, 0);
    const yearly = monthly * 12;
    const upcoming = active.filter(b => {
      const days = getDaysUntilDue(b.next_due_date);
      return days !== null && days >= 0 && days <= 7;
    });
    const overdue = active.filter(b => {
      const days = getDaysUntilDue(b.next_due_date);
      return days !== null && days < 0;
    });
    return { total: active.length, monthly, yearly, upcoming: upcoming.length, overdue: overdue.length };
  }, [bills]);

  const filteredBills = useMemo(() => {
    let result = bills;
    if (filter === 'active') result = result.filter(b => b.is_active);
    if (filter === 'upcoming') result = result.filter(b => {
      const days = getDaysUntilDue(b.next_due_date);
      return days !== null && days >= 0 && days <= 7;
    });
    return result;
  }, [bills, filter]);

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <motion.div
        variants={stagger.container} initial="hidden" animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { label: 'Active Bills', value: String(summary.total), icon: Receipt, color: 'text-primary' },
          { label: 'Monthly Cost', value: formatCurrency(summary.monthly), icon: TrendingUp, color: 'text-expense' },
          { label: 'Due This Week', value: String(summary.upcoming), icon: CalendarClock, color: 'text-[hsl(var(--warning))]' },
          { label: 'Overdue', value: String(summary.overdue), icon: AlertTriangle, color: summary.overdue > 0 ? 'text-expense' : 'text-income' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={stagger.item}>
              <Card className="border-border/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                  </div>
                  <p className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Header + Filter + Add */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5">
          {(['all', 'active', 'upcoming'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className="rounded-xl text-xs h-8 capitalize"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>{editingBill ? 'Edit Bill' : 'Add Bill / Subscription'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Netflix, Rent, etc." className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BILL_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Next Due Date</Label>
                  <Input type="date" value={nextDueDate || dueDate} onChange={e => setNextDueDate(e.target.value)} className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Provider</Label>
                  <Input value={provider} onChange={e => setProvider(e.target.value)} placeholder="Optional" className="rounded-xl mt-1" />
                </div>
                <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Auto-Pay</p>
                    <p className="text-[10px] text-muted-foreground">Automatically deducted</p>
                  </div>
                  <Switch checked={autoPay} onCheckedChange={setAutoPay} />
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={saving || !name.trim() || !amount} className="w-full rounded-xl">
                {saving ? 'Saving...' : editingBill ? 'Update Bill' : 'Add Bill'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bills List */}
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredBills.length > 0 ? filteredBills.map((bill) => {
            const cat = getCatInfo(bill.category);
            const days = getDaysUntilDue(bill.next_due_date);
            const status = getDueStatus(days);
            return (
              <motion.div
                key={bill.id}
                variants={stagger.item}
                layout
                exit={{ opacity: 0, x: -20 }}
                className="group"
              >
                <Card className="border-border/30 hover:border-border/60 transition-all">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center text-lg shrink-0">
                        {cat.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{bill.name}</p>
                          {bill.auto_pay && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded-full">Auto</Badge>
                          )}
                          {!bill.is_active && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 rounded-full text-muted-foreground">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground capitalize">{bill.frequency}</span>
                          {bill.provider && (
                            <>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] text-muted-foreground">{bill.provider}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-sm">{formatCurrency(Number(bill.amount))}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => markPaid(bill)} className="gap-2 text-xs cursor-pointer">
                            <CheckCircle className="w-3.5 h-3.5 text-income" /> Mark as Paid
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(bill)} className="gap-2 text-xs cursor-pointer">
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteBill(bill.id)} className="gap-2 text-xs text-destructive cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          }) : (
            <motion.div variants={stagger.item} className="text-center py-12">
              <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-muted-foreground text-sm">No bills yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">Add your recurring bills to track them</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Monthly Summary Footer */}
      {bills.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="border-primary/10 bg-gradient-to-r from-card to-primary/[0.02]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Annual Subscription Cost</p>
                  <p className="text-xl font-bold font-mono text-expense">{formatCurrency(summary.yearly)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Average</p>
                  <p className="text-xl font-bold font-mono">{formatCurrency(summary.monthly)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
