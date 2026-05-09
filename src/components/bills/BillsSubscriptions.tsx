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
import { useSettings } from '@/hooks/useSettings';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { convertTo } from '@/lib/currency';
import { FXConverter } from '@/components/shared/FXConverter';

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
  const { settings } = useSettings();
  const { rates } = useExchangeRates();
  const baseCurrency = settings.default_currency;
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming'>('all');
  // Per-bill FX rate override (when paying from a different-currency account)
  const [fxRates, setFxRates] = useState<Record<string, number>>({});

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
  const [payCycles, setPayCycles] = useState<number>(1);
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

  const markPaid = async (bill: Bill, sourceAccountId?: string, cycles: number = 1) => {
    if (!user) return;
    const safeCycles = Math.max(1, Math.min(12, Math.floor(cycles)));

    // Determine source account: explicit pick > stored payFromAccount > first active
    const pickedId = sourceAccountId || payFromAccount;
    const targetAccount = pickedId
      ? accounts.find(a => a.id === pickedId)
      : accounts.find(a => a.is_active && !a.is_archived);

    if (!targetAccount) {
      toast.error('No account available — add an account first');
      return;
    }

    // Cross-currency payment supported via FX. Original bill currency + rate stored in tags for audit.
    const fxRate = targetAccount.currency !== bill.currency
      ? (fxRates[bill.id] ?? convertTo(1, bill.currency, targetAccount.currency, rates))
      : 1;

    const totalCostInBillCurrency = Number(bill.amount) * safeCycles;
    const totalCostInAccountCurrency = totalCostInBillCurrency * fxRate;

    if (Number(targetAccount.balance) < totalCostInAccountCurrency) {
      toast.error(`Insufficient balance in ${targetAccount.name} for ${safeCycles} cycle${safeCycles > 1 ? 's' : ''}`);
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

    // Build N transactions, one per cycle (dated at each cycle's due date)
    const startDate = bill.next_due_date || todayInTz();
    const fxTags = targetAccount.currency !== bill.currency
      ? [`fx:original=${Number(bill.amount)} ${bill.currency}`, `fx:rate=${fxRate.toFixed(6)}`]
      : [];
    const txRows = Array.from({ length: safeCycles }, (_, i) => {
      const cycleDate = i === 0 ? startDate : calculateNextDate(startDate, bill.frequency, i);
      // Always written in source-account currency for account integrity
      const amountInAccount = Number(bill.amount) * fxRate;
      return {
        user_id: user.id,
        account_id: targetAccount.id,
        type: 'expense' as const,
        amount: amountInAccount,
        currency: targetAccount.currency,
        date: cycleDate,
        description: `${bill.name} — ${bill.frequency} payment${safeCycles > 1 ? ` (${i + 1}/${safeCycles})` : ''}`,
        merchant: bill.provider || bill.name,
        payment_method: bill.auto_pay ? 'auto_debit' : 'cash',
        status: 'completed' as const,
        category_id: categoryId,
        tags: ['bill-payment', bill.category, ...fxTags],
      };
    });

    const { error: txError } = await supabase.from('transactions').insert(txRows as any);
    if (txError) {
      toast.error('Failed to record payment');
      return;
    }

    await supabase.from('accounts').update({
      balance: Number(targetAccount.balance) - totalCostInAccountCurrency,
    }).eq('id', targetAccount.id);

    // Advance next_due_date by N cycles, set last_paid_date to today
    const today = todayInTz();
    const newNextDue = calculateNextDate(startDate, bill.frequency, safeCycles);
    await supabase.from('bills_subscriptions').update({
      last_paid_date: today,
      next_due_date: newNextDue,
    }).eq('id', bill.id);

    onTransactionCreated?.();
    toast.success(
      safeCycles > 1
        ? `${bill.name}: ${safeCycles} cycles paid (${formatCurrency(totalCostInAccountCurrency, targetAccount.currency as any)}) from ${targetAccount.name}`
        : `${bill.name} paid from ${targetAccount.name}`
    );
    fetchBills();
  };

  const calculateNextDate = (from: string, freq: string, cycles: number = 1): string => {
    // Use noon UTC to avoid TZ drift when adding months/years
    const d = new Date(`${from}T12:00:00Z`);
    const n = Math.max(1, Math.floor(cycles));
    switch (freq) {
      case 'weekly': d.setUTCDate(d.getUTCDate() + 7 * n); break;
      case 'biweekly': d.setUTCDate(d.getUTCDate() + 14 * n); break;
      case 'monthly': d.setUTCMonth(d.getUTCMonth() + n); break;
      case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3 * n); break;
      case 'yearly': d.setUTCFullYear(d.getUTCFullYear() + n); break;
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

  // Summary stats — converted to base currency for cross-currency aggregation
  const summary = useMemo(() => {
    const active = bills.filter(b => b.is_active);
    const monthly = active.reduce((sum, b) => {
      const amtInBase = convertTo(Number(b.amount), b.currency || baseCurrency, baseCurrency, rates);
      switch (b.frequency) {
        case 'weekly': return sum + amtInBase * 4.33;
        case 'biweekly': return sum + amtInBase * 2.17;
        case 'monthly': return sum + amtInBase;
        case 'quarterly': return sum + amtInBase / 3;
        case 'yearly': return sum + amtInBase / 12;
        default: return sum + amtInBase;
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
    const distinctCurrencies = Array.from(new Set(active.map(b => b.currency || baseCurrency)));
    return { total: active.length, monthly, yearly, upcoming: upcoming.length, overdue: overdue.length, distinctCurrencies };
  }, [bills, rates, baseCurrency]);

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
        className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3"
      >
        {[
          { label: 'Active Bills', value: String(summary.total), icon: Receipt, color: 'text-primary' },
          { label: 'Monthly Cost', value: formatCurrency(summary.monthly, baseCurrency), icon: TrendingUp, color: 'text-expense' },
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
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px] gap-1 shrink-0"
                            title="Mark as paid"
                          >
                            <CheckCircle className="w-3 h-3 text-income" /> Pay
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 p-3 space-y-2.5">
                          <p className="text-xs font-semibold">Pay {bill.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatCurrency(Number(bill.amount) * payCycles, bill.currency as any)} total
                            {payCycles > 1 ? ` (${payCycles} × ${bill.frequency})` : ''} will be deducted.
                          </p>

                          {/* Pay-forward stepper */}
                          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/40 border border-border/40">
                            <span className="text-[10px] font-medium text-muted-foreground">Pay forward</span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button" variant="ghost" size="icon"
                                className="h-6 w-6 rounded-md"
                                onClick={() => setPayCycles(c => Math.max(1, c - 1))}
                                disabled={payCycles <= 1}
                              >−</Button>
                              <span className="text-xs font-bold font-mono w-6 text-center">{payCycles}</span>
                              <Button
                                type="button" variant="ghost" size="icon"
                                className="h-6 w-6 rounded-md"
                                onClick={() => setPayCycles(c => Math.min(12, c + 1))}
                                disabled={payCycles >= 12}
                              >+</Button>
                              <span className="text-[9px] text-muted-foreground ml-1 capitalize">{bill.frequency}</span>
                            </div>
                          </div>

                          <Select onValueChange={setPayFromAccount} value={payFromAccount}>
                            <SelectTrigger className="rounded-lg h-8 text-xs">
                              <SelectValue placeholder="Pay from any account…" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts
                                .filter(a => a.is_active && !a.is_archived)
                                .map(a => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name} ({formatCurrency(Number(a.balance), a.currency)})
                                    {a.currency !== bill.currency ? ` · FX` : ''}
                                  </SelectItem>
                                ))}
                              {accounts.filter(a => a.is_active && !a.is_archived).length === 0 && (
                                <div className="p-2 text-[10px] text-muted-foreground">
                                  No active accounts.
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          {(() => {
                            const acc = accounts.find(a => a.id === payFromAccount);
                            if (!acc || acc.currency === bill.currency) return null;
                            return (
                              <FXConverter
                                amount={Number(bill.amount) * payCycles}
                                fromCurrency={bill.currency}
                                toCurrency={acc.currency}
                                rate={fxRates[bill.id]}
                                onRateChange={(r) => setFxRates(prev => ({ ...prev, [bill.id]: r }))}
                              />
                            );
                          })()}
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={() => { markPaid(bill, payFromAccount, payCycles); setPayCycles(1); }}
                            disabled={!payFromAccount}
                          >
                            Confirm Payment{payCycles > 1 ? ` × ${payCycles}` : ''}
                          </Button>
                        </PopoverContent>
                      </Popover>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 shrink-0"
                        onClick={() => openEdit(bill)}
                        title="Edit bill"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
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
                  <p className="text-xl font-bold font-mono text-expense">{formatCurrency(summary.yearly, baseCurrency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Average</p>
                  <p className="text-xl font-bold font-mono">{formatCurrency(summary.monthly, baseCurrency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
