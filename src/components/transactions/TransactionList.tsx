import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Download, Filter, X, Store, FileText, CheckCircle2, Clock, ExternalLink
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
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
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

  // Advanced filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const [filterMerchant, setFilterMerchant] = useState('');

  const form = useForm<EditTransactionData>({
    resolver: zodResolver(editTransactionSchema),
  });

  // Time-based filtering
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

  // Advanced filter + search
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return timeFilteredTransactions.filter(t => {
      const txn = t as any;
      const category = categories.find(c => c.id === t.category_id);
      const account = accounts.find(a => a.id === t.account_id);

      // Search
      const matchesSearch = !query || (
        t.description?.toLowerCase().includes(query) ||
        category?.name.toLowerCase().includes(query) ||
        account?.name.toLowerCase().includes(query) ||
        txn.merchant?.toLowerCase().includes(query) ||
        t.type.includes(query) ||
        t.tags?.some((tag: string) => tag.toLowerCase().includes(query)) ||
        String(t.amount).includes(query)
      );

      // Filters
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
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Summary stats
  const summaryIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const summaryExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const hasActiveFilters = filterType !== 'all' || filterCategory !== 'all' || filterAccount !== 'all' || filterStatus !== 'all' || filterAmountMin || filterAmountMax || filterMerchant;

  const clearFilters = () => {
    setFilterType('all');
    setFilterCategory('all');
    setFilterAccount('all');
    setFilterStatus('all');
    setFilterAmountMin('');
    setFilterAmountMax('');
    setFilterMerchant('');
    setCurrentPage(1);
  };

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransactions.map(t => t.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    setLoading(true);
    try {
      for (const id of selectedIds) {
        const txn = transactions.find(t => t.id === id);
        if (!txn) continue;
        const account = accounts.find(a => a.id === txn.account_id);
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
        if (account) {
          const reverse = txn.type === 'income' ? -Number(txn.amount) : Number(txn.amount);
          await supabase.from('accounts').update({ balance: Number(account.balance) + reverse }).eq('id', account.id);
        }
      }
      toast.success(`Deleted ${selectedIds.size} transactions`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Bulk delete failed');
    } finally {
      setLoading(false);
    }
  };

  // CSV Export
  const exportCSV = useCallback(() => {
    const rows = [
      ['Date', 'Type', 'Amount', 'Currency', 'Merchant', 'Description', 'Category', 'Account', 'Payment Method', 'Status', 'Tags', 'Notes'].join(','),
      ...filteredTransactions.map(t => {
        const txn = t as any;
        const cat = categories.find(c => c.id === t.category_id)?.name || '';
        const acct = accounts.find(a => a.id === t.account_id)?.name || '';
        return [
          t.date, t.type, t.amount, t.currency,
          `"${(txn.merchant || '').replace(/"/g, '""')}"`,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          `"${cat}"`, `"${acct}"`,
          txn.payment_method || 'cash',
          txn.status || 'completed',
          `"${(t.tags || []).join(', ')}"`,
          `"${(t.notes || '').replace(/"/g, '""')}"`,
        ].join(',');
      }),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transactions exported');
  }, [filteredTransactions, categories, accounts]);

  const openEdit = (transaction: Transaction) => {
    const txn = transaction as any;
    setEditingTransaction(transaction);
    form.reset({
      type: transaction.type,
      amount: String(transaction.amount),
      account_id: transaction.account_id,
      category_id: transaction.category_id || undefined,
      description: transaction.description || '',
      merchant: txn.merchant || '',
      notes: transaction.notes || '',
      date: transaction.date,
      payment_method: txn.payment_method || 'cash',
      status: txn.status || 'completed',
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
        type: data.type as TransactionType,
        amount: Number(data.amount),
        account_id: data.account_id,
        category_id: data.category_id || null,
        description: data.description || null,
        merchant: data.merchant || null,
        notes: data.notes || null,
        date: data.date,
        currency: newAcct.currency as CurrencyCode,
        payment_method: data.payment_method || 'cash',
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

      toast.success('Transaction updated');
      setEditOpen(false);
      setEditingTransaction(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const txn = transactions.find(t => t.id === id);
      if (!txn) throw new Error('Not found');
      const account = accounts.find(a => a.id === txn.account_id);
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      if (account) {
        const reverse = txn.type === 'income' ? -Number(txn.amount) : Number(txn.amount);
        await supabase.from('accounts').update({ balance: Number(account.balance) + reverse }).eq('id', account.id);
      }
      toast.success('Transaction deleted');
      setDeleteConfirmId(null);
      onRefresh();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'income': return <TrendingUp className="w-4 h-4 text-income" />;
      case 'expense': return <TrendingDown className="w-4 h-4 text-expense" />;
      default: return <ArrowLeftRight className="w-4 h-4 text-primary" />;
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'income': return 'text-income';
      case 'expense': return 'text-expense';
      default: return 'text-primary';
    }
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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Transactions
                <Badge variant="secondary" className="text-xs">{filteredTransactions.length}</Badge>
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 hidden sm:flex">
                  <Download className="w-4 h-4" /> Export
                </Button>
              </div>
            </div>

            {/* Summary stats */}
            {filteredTransactions.length > 0 && (
              <div className="flex gap-4 text-xs">
                <span className="text-income font-medium">↑ Income: {formatCurrency(summaryIncome)}</span>
                <span className="text-expense font-medium">↓ Expenses: {formatCurrency(summaryExpense)}</span>
                <span className={cn("font-semibold", summaryIncome - summaryExpense >= 0 ? 'text-income' : 'text-expense')}>
                  Net: {formatCurrency(summaryIncome - summaryExpense)}
                </span>
              </div>
            )}

            {/* Timeframe + Search + Filter toggle */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {timeFrameOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setTimeFrame(opt.value); setCurrentPage(1); }}
                    className={cn(
                      "px-2.5 py-1.5 text-xs font-medium transition-colors",
                      timeFrame === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by merchant, description, tag, amount..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-9"
                />
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1.5"
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && <Badge variant="destructive" className="h-4 w-4 p-0 text-[10px] flex items-center justify-center">!</Badge>}
              </Button>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account</Label>
                  <Select value={filterAccount} onValueChange={(v) => { setFilterAccount(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                  <Label className="text-xs">Min Amount</Label>
                  <Input type="number" className="h-8 text-xs" placeholder="0" value={filterAmountMin} onChange={(e) => { setFilterAmountMin(e.target.value); setCurrentPage(1); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Amount</Label>
                  <Input type="number" className="h-8 text-xs" placeholder="∞" value={filterAmountMax} onChange={(e) => { setFilterAmountMax(e.target.value); setCurrentPage(1); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Merchant</Label>
                  <Input className="h-8 text-xs" placeholder="Filter merchant..." value={filterMerchant} onChange={(e) => { setFilterMerchant(e.target.value); setCurrentPage(1); }} />
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearFilters}>
                    <X className="w-3 h-3 mr-1" /> Clear All
                  </Button>
                </div>
              </div>
            )}

            {/* Bulk actions bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {paginatedTransactions.length > 0 ? (
            <>
              {/* Header row for desktop */}
              <div className="hidden sm:grid grid-cols-[32px_1fr_120px_100px_120px_80px] gap-3 px-3 py-2 text-xs text-muted-foreground font-medium border-b border-border mb-2">
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

              <div className="space-y-1">
                {paginatedTransactions.map((transaction) => {
                  const txn = transaction as any;
                  const category = categories.find(c => c.id === transaction.category_id);
                  const account = accounts.find(a => a.id === transaction.account_id);
                  const statusCfg = STATUS_CONFIG[txn.status || 'completed'] || STATUS_CONFIG.completed;

                  return (
                    <div
                      key={transaction.id}
                      className={cn(
                        "flex sm:grid sm:grid-cols-[32px_1fr_120px_100px_120px_80px] items-center gap-3 p-3 rounded-lg transition-colors group",
                        selectedIds.has(transaction.id) ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 hover:bg-muted/50'
                      )}
                    >
                      {/* Checkbox */}
                      <div className="hidden sm:block">
                        <Checkbox
                          checked={selectedIds.has(transaction.id)}
                          onCheckedChange={() => toggleSelect(transaction.id)}
                        />
                      </div>

                      {/* Details */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0">
                          {category?.icon || getTypeIcon(transaction.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate">
                              {txn.merchant || transaction.description || category?.name || 'Transaction'}
                            </p>
                            {txn.recurring_interval && txn.recurring_interval !== 'none' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">🔄 {txn.recurring_interval}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span>{formatDate(transaction.date)}</span>
                            {txn.payment_method && txn.payment_method !== 'cash' && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{txn.payment_method.replace('_', ' ')}</span>
                              </>
                            )}
                            {txn.status && txn.status !== 'completed' && (
                              <>
                                <span>•</span>
                                <span className={statusCfg.color}>{statusCfg.label}</span>
                              </>
                            )}
                            {txn.receipt_url && (
                              <>
                                <span>•</span>
                                <a href={txn.receipt_url} target="_blank" rel="noopener" className="text-primary flex items-center gap-0.5">
                                  <FileText className="w-3 h-3" /> Receipt
                                </a>
                              </>
                            )}
                          </div>
                          {transaction.tags && transaction.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {transaction.tags.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Category (desktop) */}
                      <div className="hidden sm:block text-xs text-muted-foreground truncate">
                        {category ? `${category.icon} ${category.name}` : '—'}
                      </div>

                      {/* Account (desktop) */}
                      <div className="hidden sm:block text-xs text-muted-foreground truncate">
                        {account?.name || '—'}
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <span className={cn("font-mono font-semibold text-sm", getAmountColor(transaction.type))}>
                          {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                          {formatCurrency(Number(transaction.amount), transaction.currency)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(transaction)}>
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setDeleteConfirmId(transaction.id)} disabled={deleting === transaction.id}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                      const page = start + i;
                      if (page > totalPages) return null;
                      return (
                        <Button key={page} variant={page === currentPage ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(page)} className="w-8 h-8 p-0">
                          {page}
                        </Button>
                      );
                    })}
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No transactions found</p>
              <p className="text-sm">{hasActiveFilters ? 'Try adjusting your filters' : timeFrame !== 'all' ? `No transactions for this ${timeFrame} period` : 'Add your first transaction to get started'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this transaction and reverse its effect on your account balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all selected transactions and reverse their effects on account balances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete All
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
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => form.setValue('type', option.value as TransactionType)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                      watchedType === option.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    )}
                  >
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
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                    ))}
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
                    {filteredCategoriesForEdit.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
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
