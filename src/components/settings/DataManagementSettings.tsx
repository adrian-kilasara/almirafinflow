import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Download, Trash2, Loader2, Database, RotateCcw, FileJson, FileSpreadsheet, AlertOctagon } from 'lucide-react';
import { logActivity } from '@/lib/activityLogger';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function DataManagementSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [wipingAll, setWipingAll] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState('');

  const handleClearAllData = async () => {
    if (!user || wipeConfirm !== 'DELETE') return;
    setWipingAll(true);
    try {
      await logActivity(user.id, 'data_wipe_started', 'settings', { scope: 'all_except_auth' });
      // Order matters: dependents first
      const tables = [
        'transaction_history','savings_allocations','loan_payments','reconciliation_sessions',
        'transactions','transfers','budgets','savings_goals','bills_subscriptions',
        'investments','recurring_schedules','transaction_rules','financial_tips',
        'notifications','user_streaks','user_badges','user_lesson_progress',
        'account_audit_log','accounts','categories','activity_logs',
      ] as const;
      const results = await Promise.allSettled(
        tables.map((t) => (supabase.from(t as any) as any).delete().eq('user_id', user.id))
      );
      const failed = results
        .map((r, i) => (r.status === 'rejected' ? tables[i] : null))
        .filter(Boolean);
      // Reset user_settings to defaults by deleting; trigger recreates on next signin
      await (supabase.from('user_settings') as any).delete().eq('user_id', user.id);
      if (failed.length) {
        toast.warning(`Wiped, but ${failed.length} table(s) failed: ${failed.join(', ')}`);
      } else {
        toast.success('All data wiped. Your account is intact.');
      }
      setWipeConfirm('');
    } catch (e: any) {
      toast.error(e.message || 'Wipe failed');
    } finally {
      setWipingAll(false);
    }
  };

  const handleExportJSON = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [accountsRes, transactionsRes, budgetsRes, goalsRes, categoriesRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('savings_goals').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
      ]);
      const exportData = {
        exported_at: new Date().toISOString(),
        user_email: user.email,
        accounts: accountsRes.data || [],
        transactions: transactionsRes.data || [],
        budgets: budgetsRes.data || [],
        savings_goals: goalsRes.data || [],
        categories: categoriesRes.data || [],
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finflow-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const { data: transactions } = await supabase
        .from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
      if (!transactions?.length) {
        toast.error('No transactions to export');
        setExporting(false);
        return;
      }
      const headers = ['Date', 'Type', 'Amount', 'Currency', 'Description', 'Notes', 'Tags'];
      const rows = transactions.map(t => [
        t.date, t.type, t.amount, t.currency, t.description || '', t.notes || '', (t.tags || []).join(';')
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finflow-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleClearTransactions = async () => {
    if (!user) return;
    setClearing(true);
    try {
      await supabase.from('transactions').delete().eq('user_id', user.id);
      toast.success('All transactions cleared');
    } catch {
      toast.error('Failed to clear transactions');
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('budgets').delete().eq('user_id', user.id);
      await supabase.from('savings_allocations').delete().eq('user_id', user.id);
      await supabase.from('savings_goals').delete().eq('user_id', user.id);
      await supabase.from('accounts').delete().eq('user_id', user.id);
      await supabase.from('categories').delete().eq('user_id', user.id);
      await supabase.from('user_streaks').delete().eq('user_id', user.id);
      await supabase.from('user_badges').delete().eq('user_id', user.id);
      await supabase.from('user_lesson_progress').delete().eq('user_id', user.id);
      await supabase.from('financial_tips').delete().eq('user_id', user.id);
      await supabase.from('transaction_rules').delete().eq('user_id', user.id);
      await (supabase.from('user_settings') as any).delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('user_id', user.id);
      await signOut();
      toast.success('Account deleted');
      navigate('/auth');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {/* Export */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Export Data</p>
                <p className="text-[9px] text-muted-foreground">Download your financial data</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={handleExportJSON} disabled={exporting} variant="outline" className="w-full h-20 flex-col gap-2 rounded-xl">
                  {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileJson className="w-5 h-5 text-primary" />}
                  <span className="text-[10px] font-bold">Export JSON</span>
                </Button>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={handleExportCSV} disabled={exporting} variant="outline" className="w-full h-20 flex-col gap-2 rounded-xl">
                  {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5 text-income" />}
                  <span className="text-[10px] font-bold">Export CSV</span>
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Clear */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden border-[hsl(var(--warning))]/20">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[hsl(var(--warning))]">Clear Transactions</p>
                <p className="text-[9px] text-muted-foreground">Remove all transactions but keep accounts and settings</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={clearing} className="rounded-xl border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))]">
                  {clearing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                  Clear All Transactions
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all transactions?</AlertDialogTitle>
                  <AlertDialogDescription>This removes all transaction records. Accounts, budgets, and goals will remain.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearTransactions}>Clear Transactions</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>

      {/* Clear ALL data */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden border-destructive/40">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertOctagon className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs font-bold text-destructive">Clear ALL Data</p>
                <p className="text-[9px] text-muted-foreground">Wipes every financial record, category, badge, lesson progress and setting. Your sign-in account remains.</p>
              </div>
            </div>
            <AlertDialog onOpenChange={(o) => { if (!o) setWipeConfirm(''); }}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={wipingAll} className="rounded-xl border-destructive/40 text-destructive">
                  {wipingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertOctagon className="w-4 h-4 mr-2" />}
                  Clear ALL Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Wipe every record?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes transactions, transfers, accounts, budgets, savings goals, bills, investments,
                    loans, categories, notifications, streaks, badges, lesson progress, transaction rules and
                    settings. Your login account stays so you can start fresh. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="wipe-confirm" className="text-xs">Type <span className="font-bold text-destructive">DELETE</span> to confirm</Label>
                  <Input
                    id="wipe-confirm"
                    value={wipeConfirm}
                    onChange={(e) => setWipeConfirm(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllData}
                    disabled={wipeConfirm !== 'DELETE'}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Wipe Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>


      {/* Delete */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden border-destructive/30">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs font-bold text-destructive">Delete Account</p>
                <p className="text-[9px] text-muted-foreground">Permanently delete your account and all data</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting} className="rounded-xl">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>This permanently deletes your account and all associated data. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
