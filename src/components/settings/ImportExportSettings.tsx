import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Upload, Download, FileJson, FileSpreadsheet, FileText,
  Loader2, CheckCircle, AlertTriangle
} from 'lucide-react';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function ImportExportSettings() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('CSV file is empty or has no data rows');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const rows = lines.slice(1);

      // Map CSV headers to transaction fields
      const dateIdx = headers.findIndex(h => ['date', 'transaction_date', 'trans_date'].includes(h));
      const typeIdx = headers.findIndex(h => ['type', 'transaction_type', 'trans_type'].includes(h));
      const amountIdx = headers.findIndex(h => ['amount', 'value', 'sum'].includes(h));
      const descIdx = headers.findIndex(h => ['description', 'desc', 'memo', 'narration', 'details'].includes(h));
      const notesIdx = headers.findIndex(h => ['notes', 'note', 'remarks'].includes(h));

      if (amountIdx === -1) {
        toast.error('CSV must have an "Amount" column');
        return;
      }

      // Get user's first account for import
      const { data: accounts } = await supabase
        .from('accounts').select('id').eq('user_id', user.id).limit(1);

      if (!accounts?.length) {
        toast.error('Create an account first before importing');
        return;
      }
      const accountId = accounts[0].id;

      let success = 0;
      let failed = 0;

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const records = batch.map(row => {
          const cols = parseCSVRow(row);
          const amount = parseFloat(cols[amountIdx] || '0');
          if (isNaN(amount) || amount === 0) return null;

          let type: 'income' | 'expense' = amount > 0 ? 'income' : 'expense';
          if (typeIdx !== -1) {
            const t = (cols[typeIdx] || '').toLowerCase().replace(/"/g, '');
            if (t === 'income' || t === 'credit' || t === 'cr') type = 'income';
            else if (t === 'expense' || t === 'debit' || t === 'dr') type = 'expense';
          }

          let date = new Date().toISOString().split('T')[0];
          if (dateIdx !== -1 && cols[dateIdx]) {
            const parsed = new Date(cols[dateIdx].replace(/"/g, ''));
            if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0];
          }

          return {
            user_id: user.id,
            account_id: accountId,
            type,
            amount: Math.abs(amount),
            date,
            description: descIdx !== -1 ? (cols[descIdx] || '').replace(/"/g, '').trim() || null : null,
            notes: notesIdx !== -1 ? (cols[notesIdx] || '').replace(/"/g, '').trim() || null : null,
          };
        }).filter(Boolean);

        if (records.length > 0) {
          const { error } = await supabase.from('transactions').insert(records as any);
          if (error) {
            failed += records.length;
          } else {
            success += records.length;
          }
        }
      }

      setImportResult({ success, failed });
      if (success > 0) toast.success(`Imported ${success} transactions`);
      if (failed > 0) toast.error(`${failed} rows failed to import`);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const parseCSVRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of row) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += char;
    }
    result.push(current.trim());
    return result;
  };

  const handleExportJSON = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [acct, txn, budg, goals, cats, bills, inv] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('savings_goals').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('bills_subscriptions').select('*').eq('user_id', user.id),
        supabase.from('investments').select('*').eq('user_id', user.id),
      ]);
      const data = {
        exported_at: new Date().toISOString(),
        accounts: acct.data || [], transactions: txn.data || [], budgets: budg.data || [],
        savings_goals: goals.data || [], categories: cats.data || [],
        bills_subscriptions: bills.data || [], investments: inv.data || [],
      };
      downloadFile(JSON.stringify(data, null, 2), `finflow-export-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      toast.success('JSON exported');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const handleExportCSV = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const { data } = await supabase
        .from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
      if (!data?.length) { toast.error('No transactions'); setExporting(false); return; }
      const headers = ['Date', 'Type', 'Amount', 'Currency', 'Description', 'Merchant', 'Notes', 'Tags', 'Status'];
      const rows = data.map(t => [
        t.date, t.type, t.amount, t.currency,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${(t.merchant || '').replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
        `"${(t.tags || []).join(';')}"`,
        t.status || 'completed',
      ].join(','));
      downloadFile([headers.join(','), ...rows].join('\n'), `finflow-transactions-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      toast.success('CSV exported');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {/* Import */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-income/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-income/10 flex items-center justify-center">
                <Upload className="w-4 h-4 text-income" />
              </div>
              <div>
                <p className="text-xs font-bold">Import Transactions</p>
                <p className="text-[9px] text-muted-foreground">Import from CSV files (bank statements, Excel exports)</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/30 transition-colors text-center">
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVImport} className="hidden" id="csv-import" />
              <label htmlFor="csv-import" className="cursor-pointer">
                {importing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Processing...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs font-medium">Click to upload CSV</p>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Required column: <span className="font-mono text-foreground">Amount</span>. Optional: Date, Type, Description, Notes
                    </p>
                  </>
                )}
              </label>
            </div>

            {importResult && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
              >
                {importResult.failed === 0 ? (
                  <CheckCircle className="w-4 h-4 text-income shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))] shrink-0" />
                )}
                <div className="text-xs">
                  <span className="font-semibold text-income">{importResult.success} imported</span>
                  {importResult.failed > 0 && (
                    <span className="text-muted-foreground"> · {importResult.failed} failed</span>
                  )}
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

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
                <p className="text-[9px] text-muted-foreground">Download all your financial data</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={handleExportJSON} disabled={exporting} variant="outline" className="w-full h-20 flex-col gap-2 rounded-xl">
                  {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileJson className="w-5 h-5 text-primary" />}
                  <span className="text-[10px] font-bold">Full Backup (JSON)</span>
                </Button>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={handleExportCSV} disabled={exporting} variant="outline" className="w-full h-20 flex-col gap-2 rounded-xl">
                  {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5 text-income" />}
                  <span className="text-[10px] font-bold">Transactions (CSV)</span>
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* CSV Format Guide */}
      <motion.div variants={stagger.item}>
        <Card className="border-border/30">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-bold">CSV Import Format</p>
                <p className="text-[9px] text-muted-foreground">Your CSV should follow this structure</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 font-mono text-[10px] leading-relaxed overflow-x-auto">
              <p className="text-muted-foreground">Date,Type,Amount,Description,Notes</p>
              <p>2026-03-01,income,50000,Salary,March salary</p>
              <p>2026-03-02,expense,15000,Rent,Monthly rent</p>
              <p>2026-03-05,expense,3500,Groceries,Weekly shopping</p>
            </div>
            <div className="text-[9px] text-muted-foreground space-y-1">
              <p>• <span className="font-semibold text-foreground">Amount</span> column is required (positive = income, negative = expense)</p>
              <p>• <span className="font-semibold text-foreground">Type</span> can be: income, expense, credit, debit, cr, dr</p>
              <p>• Transactions import to your first account by default</p>
              <p>• Compatible with most bank CSV statement exports</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
