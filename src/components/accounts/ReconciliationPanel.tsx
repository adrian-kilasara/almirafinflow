import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, CheckCircle2, AlertTriangle, ArrowLeft,
  Loader2, Scale, TrendingUp, TrendingDown, ArrowLeftRight,
} from 'lucide-react';
import type { Account, Transaction, CurrencyCode } from '@/types/finance';

interface ReconciliationPanelProps {
  account: Account;
  transactions: Transaction[];
  onBack: () => void;
  onRefresh: () => void;
}

export default function ReconciliationPanel({ account, transactions, onBack, onRefresh }: ReconciliationPanelProps) {
  const { user } = useAuth();
  const [statementBalance, setStatementBalance] = useState('');
  const [started, setStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(new Set());

  const acctTxns = useMemo(
    () => transactions
      .filter(t => t.account_id === account.id && !(t as any).is_deleted)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, account.id]
  );

  // Load already-reconciled
  useEffect(() => {
    const ids = new Set<string>();
    acctTxns.forEach(t => { if ((t as any).is_reconciled) ids.add(t.id); });
    setReconciledIds(ids);
  }, [acctTxns]);

  const systemBalance = Number(account.balance);
  const stmtBal = Number(statementBalance || 0);
  const difference = stmtBal - systemBalance;

  const reconciledTotal = useMemo(() => {
    return acctTxns
      .filter(t => reconciledIds.has(t.id))
      .reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  }, [reconciledIds, acctTxns]);

  const toggleReconcile = (id: string) => {
    setReconciledIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleStart = () => {
    if (!statementBalance || isNaN(Number(statementBalance))) {
      toast.error('Enter a valid statement balance');
      return;
    }
    setStarted(true);
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Mark transactions as reconciled
      const toReconcile = Array.from(reconciledIds);
      const toUnreconcile = acctTxns.filter(t => !reconciledIds.has(t.id)).map(t => t.id);

      if (toReconcile.length > 0) {
        await supabase.from('transactions').update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
        } as any).in('id', toReconcile);
      }
      if (toUnreconcile.length > 0) {
        await supabase.from('transactions').update({
          is_reconciled: false,
          reconciled_at: null,
        } as any).in('id', toUnreconcile);
      }

      // Save reconciliation session
      await supabase.from('reconciliation_sessions' as any).insert({
        user_id: user.id,
        account_id: account.id,
        statement_balance: stmtBal,
        system_balance: systemBalance,
        difference: Math.abs(difference),
        status: Math.abs(difference) < 0.01 ? 'balanced' : 'completed_with_difference',
        reconciled_count: toReconcile.length,
        total_count: acctTxns.length,
        completed_at: new Date().toISOString(),
      });

      toast.success(
        Math.abs(difference) < 0.01
          ? 'Account fully reconciled!'
          : `Reconciliation saved. Difference: ${formatCurrency(Math.abs(difference), account.currency)}`
      );
      onRefresh();
      onBack();
    } catch (e: any) {
      toast.error(e.message || 'Reconciliation failed');
    } finally {
      setSaving(false);
    }
  };

  const typeIcon = (type: string) => {
    if (type === 'income') return <TrendingUp className="w-3 h-3 text-income" />;
    if (type === 'expense') return <TrendingDown className="w-3 h-3 text-expense" />;
    return <ArrowLeftRight className="w-3 h-3 text-primary" />;
  };

  if (!started) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <Card className="border-primary/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl h-9 w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Reconcile: {account.name}</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">Compare system records with your bank statement</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">System Balance</span>
                <span className="text-sm font-mono font-bold">{formatCurrency(systemBalance, account.currency)}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Statement Balance (from your bank)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter bank statement balance"
                  value={statementBalance}
                  onChange={e => setStatementBalance(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              {statementBalance && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-xs font-medium">Difference</span>
                  <span className={`text-sm font-mono font-bold ${Math.abs(difference) < 0.01 ? 'text-income' : 'text-expense'}`}>
                    {difference >= 0 ? '+' : ''}{formatCurrency(difference, account.currency)}
                  </span>
                </motion.div>
              )}
            </div>
            <Button onClick={handleStart} className="w-full rounded-xl" disabled={!statementBalance}>
              <Scale className="w-4 h-4 mr-2" /> Start Reconciliation
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Summary */}
      <Card className="border-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => setStarted(false)} className="rounded-xl h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Scale className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold">Reconciling {account.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/20 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Statement</p>
              <p className="text-xs font-mono font-bold">{formatCurrency(stmtBal, account.currency)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">System</p>
              <p className="text-xs font-mono font-bold">{formatCurrency(systemBalance, account.currency)}</p>
            </div>
            <div className={`p-3 rounded-xl text-center ${Math.abs(difference) < 0.01 ? 'bg-income/10' : 'bg-expense/10'}`}>
              <p className="text-[10px] text-muted-foreground mb-1">Difference</p>
              <p className={`text-xs font-mono font-bold ${Math.abs(difference) < 0.01 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(Math.abs(difference), account.currency)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className="text-[10px]">
              {reconciledIds.size}/{acctTxns.length} reconciled
            </Badge>
            {Math.abs(difference) < 0.01 && (
              <Badge className="text-[10px] bg-income/10 text-income border-income/20">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Balanced
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction list */}
      <Card>
        <CardContent className="p-3 space-y-1.5 max-h-[400px] overflow-y-auto">
          {acctTxns.map((t, i) => {
            const isReconciled = reconciledIds.has(t.id);
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.015 }}
                onClick={() => toggleReconcile(t.id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                  isReconciled
                    ? 'bg-income/5 border-income/20'
                    : 'bg-muted/10 border-transparent hover:border-border/30'
                }`}
              >
                <Checkbox checked={isReconciled} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {typeIcon(t.type)}
                    <span className="text-xs font-medium truncate">{t.description || t.type}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatDate(t.date)}</span>
                </div>
                <span className={`text-xs font-mono font-bold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount), account.currency)}
                </span>
                {isReconciled && <CheckCircle2 className="w-3.5 h-3.5 text-income shrink-0" />}
              </motion.div>
            );
          })}
          {acctTxns.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">No transactions to reconcile</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStarted(false)} className="flex-1 rounded-xl">Cancel</Button>
        <Button onClick={handleComplete} disabled={saving} className="flex-1 rounded-xl">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
          Complete Reconciliation
        </Button>
      </div>
    </motion.div>
  );
}