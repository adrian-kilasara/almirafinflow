import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/format';
import { 
  Receipt, TrendingUp, TrendingDown, ArrowLeftRight,
  Search, Trash2, ChevronLeft, ChevronRight, Pencil, Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Transaction, Category, Account, TransactionType, CurrencyCode } from '@/types/finance';

const editTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().min(1, 'Amount is required').refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be positive'),
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  description: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  date: z.string().min(1, 'Date is required'),
});

type EditTransactionData = z.infer<typeof editTransactionSchema>;

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onRefresh: () => void;
}

const ITEMS_PER_PAGE = 10;

export default function TransactionList({ transactions, categories, accounts, onRefresh }: TransactionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<EditTransactionData>({
    resolver: zodResolver(editTransactionSchema),
  });

  const filteredTransactions = transactions.filter(t => {
    const query = searchQuery.toLowerCase();
    const category = categories.find(c => c.id === t.category_id);
    const account = accounts.find(a => a.id === t.account_id);
    
    return (
      t.description?.toLowerCase().includes(query) ||
      category?.name.toLowerCase().includes(query) ||
      account?.name.toLowerCase().includes(query) ||
      t.type.includes(query)
    );
  });

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const openEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    form.reset({
      type: transaction.type,
      amount: String(transaction.amount),
      account_id: transaction.account_id,
      category_id: transaction.category_id || undefined,
      description: transaction.description || '',
      notes: transaction.notes || '',
      date: transaction.date,
    });
    setEditOpen(true);
  };

  const handleEdit = async (data: EditTransactionData) => {
    if (!editingTransaction) return;
    setLoading(true);
    try {
      const oldTransaction = editingTransaction;
      const oldAccount = accounts.find(a => a.id === oldTransaction.account_id);
      const newAccount = accounts.find(a => a.id === data.account_id);

      if (!oldAccount || !newAccount) throw new Error('Account not found');

      // Reverse old transaction's effect on old account
      const oldBalanceChange = oldTransaction.type === 'income' 
        ? -Number(oldTransaction.amount) 
        : Number(oldTransaction.amount);
      
      // Apply new transaction's effect on new account
      const newBalanceChange = data.type === 'income' 
        ? Number(data.amount) 
        : -Number(data.amount);

      // Update the transaction
      const { error } = await supabase
        .from('transactions')
        .update({
          type: data.type as TransactionType,
          amount: Number(data.amount),
          account_id: data.account_id,
          category_id: data.category_id || null,
          description: data.description || null,
          notes: data.notes || null,
          date: data.date,
          currency: newAccount.currency as CurrencyCode,
        })
        .eq('id', oldTransaction.id);

      if (error) throw error;

      // Update account balances
      if (oldTransaction.account_id === data.account_id) {
        // Same account: apply net change
        const netChange = oldBalanceChange + newBalanceChange;
        await supabase
          .from('accounts')
          .update({ balance: Number(oldAccount.balance) + netChange })
          .eq('id', oldAccount.id);
      } else {
        // Different accounts: reverse on old, apply on new
        await Promise.all([
          supabase
            .from('accounts')
            .update({ balance: Number(oldAccount.balance) + oldBalanceChange })
            .eq('id', oldAccount.id),
          supabase
            .from('accounts')
            .update({ balance: Number(newAccount.balance) + newBalanceChange })
            .eq('id', newAccount.id),
        ]);
      }

      toast.success('Transaction updated successfully');
      setEditOpen(false);
      setEditingTransaction(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) throw new Error('Transaction not found');
      
      const account = accounts.find(a => a.id === transaction.account_id);

      // Delete the transaction
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;

      // Reverse the transaction's effect on account balance
      if (account) {
        const balanceReverse = transaction.type === 'income' 
          ? -Number(transaction.amount) 
          : Number(transaction.amount);
        await supabase
          .from('accounts')
          .update({ balance: Number(account.balance) + balanceReverse })
          .eq('id', account.id);
      }

      toast.success('Transaction deleted and balances updated');
      setDeleteConfirmId(null);
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to delete transaction');
    } finally {
      setDeleting(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <TrendingUp className="w-4 h-4 text-income" />;
      case 'expense':
        return <TrendingDown className="w-4 h-4 text-expense" />;
      default:
        return <ArrowLeftRight className="w-4 h-4 text-primary" />;
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'text-income';
      case 'expense':
        return 'text-expense';
      default:
        return 'text-primary';
    }
  };

  const watchedType = form.watch('type') as TransactionType;
  const filteredCategoriesForEdit = categories.filter(c => c.type === watchedType);

  const typeOptions = [
    { value: 'income', label: 'Income', icon: TrendingUp, color: 'text-income' },
    { value: 'expense', label: 'Expense', icon: TrendingDown, color: 'text-expense' },
    { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, color: 'text-primary' },
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Recent Transactions
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {paginatedTransactions.length > 0 ? (
            <>
              <div className="space-y-2">
                {paginatedTransactions.map((transaction) => {
                  const category = categories.find(c => c.id === transaction.category_id);
                  const account = accounts.find(a => a.id === transaction.account_id);
                  
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                          {category?.icon || getTypeIcon(transaction.type)}
                        </div>
                        <div>
                          <p className="font-medium">
                            {transaction.description || category?.name || 'Transaction'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{account?.name || 'Unknown Account'}</span>
                            <span>•</span>
                            <span>{formatDate(transaction.date)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-semibold ${getAmountColor(transaction.type)}`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(Number(transaction.amount), transaction.currency)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEdit(transaction)}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteConfirmId(transaction.id)}
                          disabled={deleting === transaction.id}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} of{' '}
                    {filteredTransactions.length} transactions
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
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
              <p className="text-sm">Add your first transaction to get started</p>
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
            <AlertDialogAction 
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingTransaction(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
            {/* Type Selector */}
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => form.setValue('type', option.value as TransactionType)}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                      watchedType === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${option.color}`} />
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

            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={form.watch('account_id')} onValueChange={(value) => form.setValue('account_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredCategoriesForEdit.length > 0 && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.watch('category_id') || ''} onValueChange={(value) => form.setValue('category_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategoriesForEdit.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="What was this for?" {...form.register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Additional details..." rows={2} {...form.register('notes')} />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
