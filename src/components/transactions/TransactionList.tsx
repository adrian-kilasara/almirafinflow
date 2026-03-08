import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  Receipt, TrendingUp, TrendingDown, ArrowLeftRight,
  Search, Trash2, ChevronLeft, ChevronRight, Pencil, Loader2,
  Download, Filter, X, FileText, CheckCircle2, Clock,
  ArrowUpRight, ArrowDownRight, Zap, BarChart3
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { emitTransactionEditEvent, emitTransactionDeleteEvent } from '@/lib/events';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transaction, Category, Account, TransactionType, CurrencyCode } from '@/types/finance';

const editTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  description: z.string().max(200).optional(),
  merchant: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  date: z.string().min(1, 'Date is required'),
  payment_method: z.string().optional(),
  status: z.string().optional(),
});

type EditTransactionData = z.infer<typeof editTransactionSchema>;
type TimeFrame = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onRefresh: () => void;
}

const ITEMS_PER_PAGE = 15;

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-income' },
  pending: { label: 'Pending', icon: Clock, color: 'text-[hsl(var(--warning))]' },
  cleared: { label: 'Cleared', icon: CheckCircle2, color: 'text-primary' },
  reconciled: { label: 'Reconciled', icon: CheckCircle2, color: 'text-accent' },
};

export default function TransactionList({ transactions, categories, accounts, onRefresh }: TransactionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const [filterMerchant, setFilterMerchant] = useState('');

  const form = useForm<EditTransactionData>({ resolver: zodResolver(editTransactionSchema) });

  const timeFilteredTransactions = useMemo(() => {
    if (timeFrame === 'all') return transactions;
    const now = new Date();
    let start: Date, end: Date;
    switch (timeFrame) {
      case 'daily': start = startOfDay(now); end = endOfDay(now); break;
      case 'weekly': start = startOfWeek(now); end = endOfWeek(now); break;
      case 'monthly': start = startOfMonth(now); end = endOfMonth(now); break;
      case 'yearly': start = startOfYear(now); end = endOfYear(now); break;
    }
    return transactions.filter(t => {
      const d = parseISO(t.date);
      return isWithinInterval(d, { start, end });
    });
  }, [transactions, timeFrame]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return timeFilteredTransactions.filter(t => {
      const txn = t as any;
      const category = categories.find(c => c.id === t.category_id);
      const account = accounts.find(a => a.id === t.account_id);
      const matchesSearch = !query || (
        t.description?.toLowerCase().includes(query) ||
        category?.name.toLowerCase().includes(query) ||
        account?.name.toLowerCase().includes(query) ||
        txn.merchant?.toLowerCase().includes(query) ||
        t.type.includes(query) ||
        t.tags?.some((tag: string) => tag.toLowerCase().includes(query)) ||
        String(t.amount).includes(query)
      );
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesCategory = filterCategory === 'all' || t.category_id === filterCategory;
      const matchesAccount = filterAccount === 'all' || t.account_id === filterAccount;
      const matchesStatus = filterStatus === 'all' || (txn.status || 'completed') === filterStatus;
      const matchesAmountMin = !filterAmountMin || Number(t.amount) >= Number(filterAmountMin);
      const matchesAmountMax = !filterAmountMax || Number(t.amount) <= Number(filterAmountMax);
      const matchesMerchant = !filterMerchant || txn.merchant?.toLowerCase().includes(filterMerchant.toLowerCase());
      return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesStatus && matchesAmountMin && matchesAmountMax && matchesMerchant;
    });
  }, [timeFilteredTransactions, searchQuery, filterType, filterCategory, filterAccount, filterStatus, filterAmountMin, filterAmountMax, filterMerchant, categories, accounts]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const summaryIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const summaryExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const summaryNet = summaryIncome - summaryExpense;
  const txnCount = filteredTransactions.length;

  const hasActiveFilters = filterType !== 'all' || filterCategory !== 'all' || filterAccount !== 'all' || filterStatus !== 'all' || filterAmountMin || filterAmountMax || filterMerchant;

  const clearFilters = () => {
    setFilterType('all'); setFilterCategory('all'); setFilterAccount('all'); setFilterStatus('all');
    setFilterAmountMin(''); setFilterAmountMax(''); setFilterMerchant(''); setCurrentPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTransactions.length) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(paginatedTransactions.map(t => t.id))); }
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    try {
      for (const id of selectedIds) {
        const txn = transactions.find(t => t.id === id);
        if (!txn) continue;
        const account = accounts.find(a => a.id === txn.account_id);
        // Soft delete
        const { error } = await supabase.from('transactions').update({
          is_deleted: true, deleted_at: new Date().toISOString(), status: 'deleted',
        } as any).eq('id', id);
        if (error) throw error;
        if (account) {
          const reverse = txn.type === 'income' ? -Number(txn.amount) : Number(txn.amount);
          await supabase.from('accounts').update({ balance: Number(account.balance) + reverse }).eq('id', account.id);
        }
      }
      toast.success(`Deleted ${selectedIds.size} transactions`);
      setSelectedIds(new Set()); setBulkDeleteOpen(false); onRefresh();
    } catch (error: any) { toast.error(error.message || 'Bulk delete failed'); }
    finally { setLoading(false); }
  };

  const exportCSV = useCallback(() => {
    const rows = [
      ['Date', 'Type', 'Amount', 'Currency', 'Merchant', 'Description', 'Category', 'Account', 'Payment Method', 'Status', 'Tags', 'Notes'].join(','),
      ...filteredTransactions.map(t => {
        const txn = t as any;
        const cat = categories.find(c => c.id === t.category_id)?.name || '';
        const acct = accounts.find(a => a.id === t.account_id)?.name || '';
        return [t.date, t.type, t.amount, t.currency, `"${(txn.merchant || '').replace(/"/g, '""')}"`, `"${(t.description || '').replace(/"/g, '""')}"`, `"${cat}"`, `"${acct}"`, txn.payment_method || 'cash', txn.status || 'completed', `"${(t.tags || []).join(', ')}"`, `"${(t.notes || '').replace(/"/g, '""')}"`].join(',');
      }),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('Transactions exported');
  }, [filteredTransactions, categories, accounts]);

  const openEdit = (transaction: Transaction) => {
    const txn = transaction as any;
    setEditingTransaction(transaction);
    form.reset({
      type: transaction.type, amount: String(transaction.amount), account_id: transaction.account_id,
      category_id: transaction.category_id || undefined, description: transaction.description || '',
      merchant: txn.merchant || '', notes: transaction.notes || '', date: transaction.date,
      payment_method: txn.payment_method || 'cash', status: txn.status || 'completed',
    });
    setEditOpen(true);
  };

  const handleEdit = async (data: EditTransactionData) => {
    if (!editingTransaction) return;
    setLoading(true);
    try {
      const old = editingTransaction;
      const oldAcct = accounts.find(a => a.id === old.account_id);
      const newAcct = accounts.find(a => a.id === data.account_id);
      if (!oldAcct || !newAcct) throw new Error('Account not found');
      const oldBalChange = old.type === 'income' ? -Number(old.amount) : Number(old.amount);
      const newBalChange = data.type === 'income' ? Number(data.amount) : -Number(data.amount);
      const { error } = await supabase.from('transactions').update({
        type: data.type as TransactionType, amount: Number(data.amount), account_id: data.account_id,
        category_id: data.category_id || null, description: data.description || null,
        merchant: data.merchant || null, notes: data.notes || null, date: data.date,
        currency: newAcct.currency as CurrencyCode, payment_method: data.payment_method || 'cash',
        status: data.status || 'completed',
      } as any).eq('id', old.id);
      if (error) throw error;
      if (old.account_id === data.account_id) {
        await supabase.from('accounts').update({ balance: Number(oldAcct.balance) + oldBalChange + newBalChange }).eq('id', oldAcct.id);
      } else {
        await Promise.all([
          supabase.from('accounts').update({ balance: Number(oldAcct.balance) + oldBalChange }).eq('id', oldAcct.id),
          supabase.from('accounts').update({ balance: Number(newAcct.balance) + newBalChange }).eq('id', newAcct.id),
        ]);
      }
      // Emit edit event for budget re-check & low balance
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await emitTransactionEditEvent(
          userData.user.id, data.type as 'income' | 'expense' | 'transfer',
          Number(data.amount), data.description || data.merchant || 'Transaction',
          data.account_id, data.category_id || null
        );
      }
      toast.success('Transaction updated'); setEditOpen(false); setEditingTransaction(null); onRefresh();
    } catch (error: any) { toast.error(error.message || 'Failed to update'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const txn = transactions.find(t => t.id === id);
      if (!txn) throw new Error('Not found');
      const account = accounts.find(a => a.id === txn.account_id);
      // Soft delete instead of hard delete
      const { error } = await supabase.from('transactions').update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        status: 'deleted',
      } as any).eq('id', id);
      if (error) throw error;
      if (account) {
        const reverse = txn.type === 'income' ? -Number(txn.amount) : Number(txn.amount);
        await supabase.from('accounts').update({ balance: Number(account.balance) + reverse }).eq('id', account.id);
      }
      // Emit delete event for balance alerts
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await emitTransactionDeleteEvent(
          userData.user.id, txn.type as 'income' | 'expense' | 'transfer',
          Number(txn.amount), txn.description || 'Transaction', txn.account_id
        );
      }
      toast.success('Transaction archived (soft deleted)'); setDeleteConfirmId(null); onRefresh();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  const watchedType = form.watch('type') as TransactionType;
  const filteredCategoriesForEdit = categories.filter(c => c.type === watchedType);

  const typeOptions = [
    { value: 'income', label: 'Income', icon: TrendingUp, color: 'text-income' },
    { value: 'expense', label: 'Expense', icon: TrendingDown, color: 'text-expense' },
    { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, color: 'text-primary' },
  ];

  const timeFrameOptions: { value: TimeFrame; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'daily', label: 'Today' },
    { value: 'weekly', label: 'Week' },
    { value: 'monthly', label: 'Month' },
    { value: 'yearly', label: 'Year' },
  ];

  return (
    <>
      <div className="space-y-4">
        {/* Summary Cards */}
        {filteredTransactions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Income', value: summaryIncome, icon: ArrowUpRight, color: 'text-income', bg: 'bg-income/10' },
              { label: 'Expenses', value: summaryExpense, icon: ArrowDownRight, color: 'text-expense', bg: 'bg-expense/10' },
              { label: 'Net Flow', value: summaryNet, icon: BarChart3, color: summaryNet >= 0 ? 'text-income' : 'text-expense', bg: 'bg-primary/10' },
              { label: 'Count', value: txnCount, icon: Zap, color: 'text-primary', bg: 'bg-primary/10', isCount: true },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="hover:border-primary/20 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`w-5 h-5 rounded-md ${stat.bg} flex items-center justify-center`}>
                        <stat.icon className={`w-3 h-3 ${stat.color}`} />
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className={`text-sm font-mono font-bold ${stat.color}`}>
                      {(stat as any).isCount ? stat.value : formatCurrency(stat.value as number)}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {/* Period selector + Search */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center p-1 rounded-xl bg-muted/50 border border-border/30">
              {timeFrameOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setTimeFrame(opt.value); setCurrentPage(1); }}
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    timeFrame === opt.value ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {timeFrame === opt.value && (
                    <motion.div
                      layoutId="txnTimeBg"
                      className="absolute inset-0 bg-card border border-border/50 rounded-lg shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search merchant, description, tag, amount..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 bg-muted/30 border-border/30"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1.5 rounded-xl"
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-destructive" />}
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 rounded-xl hidden sm:flex">
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            </div>
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</Label>
                    <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Account</Label>
                    <Select value={filterAccount} onValueChange={(v) => { setFilterAccount(v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</Label>
                    <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cleared">Cleared</SelectItem>
                        <SelectItem value="reconciled">Reconciled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min Amount</Label>
                    <Input type="number" className="h-8 text-xs bg-card" placeholder="0" value={filterAmountMin} onChange={(e) => { setFilterAmountMin(e.target.value); setCurrentPage(1); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Amount</Label>
                    <Input type="number" className="h-8 text-xs bg-card" placeholder="∞" value={filterAmountMax} onChange={(e) => { setFilterAmountMax(e.target.value); setCurrentPage(1); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Merchant</Label>
                    <Input className="h-8 text-xs bg-card" placeholder="Filter..." value={filterMerchant} onChange={(e) => { setFilterMerchant(e.target.value); setCurrentPage(1); }} />
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" className="text-xs h-8 gap-1" onClick={clearFilters}>
                      <X className="w-3 h-3" /> Clear All
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bulk actions */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <span className="text-sm font-semibold">{selectedIds.size} selected</span>
                  <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-1.5 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="rounded-lg">Cancel</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Transaction list */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {paginatedTransactions.length > 0 ? (
            <Card className="overflow-hidden">
              {/* Desktop header */}
              <div className="hidden sm:grid grid-cols-[32px_1fr_110px_100px_120px_72px] gap-3 px-4 py-2.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/50 bg-muted/30">
                <div>
                  <Checkbox
                    checked={selectedIds.size === paginatedTransactions.length && paginatedTransactions.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </div>
                <div>Details</div>
                <div>Category</div>
                <div>Account</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Actions</div>
              </div>

              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {paginatedTransactions.map((transaction, i) => {
                    const txn = transaction as any;
                    const category = categories.find(c => c.id === transaction.category_id);
                    const account = accounts.find(a => a.id === transaction.account_id);
                    const statusCfg = STATUS_CONFIG[txn.status || 'completed'] || STATUS_CONFIG.completed;

                    return (
                      <motion.div
                        key={transaction.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={cn(
                          "flex sm:grid sm:grid-cols-[32px_1fr_110px_100px_120px_72px] items-center gap-3 px-4 py-3 transition-all group hover:bg-muted/30",
                          selectedIds.has(transaction.id) && 'bg-primary/5'
                        )}
                      >
                        <div className="hidden sm:block">
                          <Checkbox checked={selectedIds.has(transaction.id)} onCheckedChange={() => toggleSelect(transaction.id)} />
                        </div>

                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            transaction.type === 'income' ? 'bg-income/10' : transaction.type === 'expense' ? 'bg-expense/10' : 'bg-primary/10'
                          }`}>
                            {category?.icon || (
                              transaction.type === 'income' ? <ArrowUpRight className="w-4 h-4 text-income" /> :
                              transaction.type === 'expense' ? <ArrowDownRight className="w-4 h-4 text-expense" /> :
                              <ArrowLeftRight className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm truncate">
                                {txn.merchant || transaction.description || category?.name || 'Transaction'}
                              </p>
                              {txn.recurring_interval && txn.recurring_interval !== 'none' && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 rounded-md">🔄 {txn.recurring_interval}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>{formatDate(transaction.date)}</span>
                              {txn.payment_method && txn.payment_method !== 'cash' && (
                                <><span className="text-border">·</span><span className="capitalize">{txn.payment_method.replace('_', ' ')}</span></>
                              )}
                              {txn.status && txn.status !== 'completed' && (
                                <><span className="text-border">·</span><span className={statusCfg.color}>{statusCfg.label}</span></>
                              )}
                              {txn.receipt_url && (
                                <><span className="text-border">·</span><a href={txn.receipt_url} target="_blank" rel="noopener" className="text-primary flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" /></a></>
                              )}
                            </div>
                            {transaction.tags && transaction.tags.length > 0 && (
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {transaction.tags.map((tag: string) => (
                                  <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 rounded-md">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="hidden sm:block text-xs text-muted-foreground truncate">
                          {category ? `${category.icon} ${category.name}` : '—'}
                        </div>

                        <div className="hidden sm:block text-xs text-muted-foreground truncate">
                          {account?.name || '—'}
                        </div>

                        <div className="text-right">
                          <span className={cn("font-mono font-bold text-sm", 
                            transaction.type === 'income' ? 'text-income' : transaction.type === 'expense' ? 'text-expense' : 'text-primary'
                          )}>
                            {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                            {formatCurrency(Number(transaction.amount), transaction.currency)}
                          </span>
                        </div>

                        <div className="flex gap-0.5 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(transaction)}>
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteConfirmId(transaction.id)} disabled={deleting === transaction.id}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/20">
                  <p className="text-[10px] text-muted-foreground">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                      const page = start + i;
                      if (page > totalPages) return null;
                      return (
                        <Button key={page} variant={page === currentPage ? "default" : "ghost"} size="icon" className="h-7 w-7 rounded-lg text-xs" onClick={() => setCurrentPage(page)}>
                          {page}
                        </Button>
                      );
                    })}
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="border-dashed border-2">
              <CardContent className="py-16 text-center">
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
                  <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                </motion.div>
                <p className="font-semibold text-foreground">No transactions found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasActiveFilters ? 'Try adjusting your filters' : timeFrame !== 'all' ? `No transactions for this ${timeFrame} period` : 'Add your first transaction to get started'}
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this transaction and reverse its effect on your account balance.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Transactions?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete all selected transactions and reverse their effects.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingTransaction(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.value} type="button" onClick={() => form.setValue('type', option.value as TransactionType)}
                    className={cn("p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                      watchedType === option.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    )}>
                    <Icon className={cn("w-5 h-5", option.color)} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...form.register('amount')} />
                {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" {...form.register('date')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={form.watch('account_id')} onValueChange={(v) => form.setValue('account_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.watch('status') || 'completed'} onValueChange={(v) => form.setValue('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">✅ Completed</SelectItem>
                    <SelectItem value="pending">⏳ Pending</SelectItem>
                    <SelectItem value="cleared">✔️ Cleared</SelectItem>
                    <SelectItem value="reconciled">🔒 Reconciled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredCategoriesForEdit.length > 0 && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.watch('category_id') || ''} onValueChange={(v) => form.setValue('category_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {filteredCategoriesForEdit.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Merchant / Payee</Label>
              <Input placeholder="e.g., Shoppers, NMB Bank" {...form.register('merchant')} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="What was this for?" {...form.register('description')} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={form.watch('payment_method') || 'cash'} onValueChange={(v) => form.setValue('payment_method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">💵 Cash</SelectItem>
                  <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">📱 Mobile Money</SelectItem>
                  <SelectItem value="card">💳 Card</SelectItem>
                  <SelectItem value="cheque">📝 Cheque</SelectItem>
                  <SelectItem value="other">💰 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional details..." rows={2} {...form.register('notes')} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
