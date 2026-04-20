import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { BarChart3, FileText, Download, Sparkles, TrendingDown, TrendingUp, Zap, Layers } from 'lucide-react';
import type { Transaction, Account, Category, Budget, SavingsGoal } from '@/types/finance';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useReportData, type ReportPeriod } from './hooks/useReportData';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { todayInTz } from '@/lib/datetime';
import { useSettings } from '@/hooks/useSettings';

import SummaryCards from './sections/SummaryCards';
import TrendChart from './sections/TrendChart';
import CategoryBreakdown from './sections/CategoryBreakdown';
import BudgetAnalysis from './sections/BudgetAnalysis';
import SavingsAndGoals from './sections/SavingsAndGoals';
import HealthScoreCard from './sections/HealthScoreCard';
import ForecastPanel from './sections/ForecastPanel';
import ActionBox from './sections/ActionBox';
import TopExpenses from './sections/TopExpenses';
import AccountBreakdownCard from './sections/AccountBreakdownCard';

interface EnhancedReportsProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  savingsGoals?: SavingsGoal[];
}

const PERIODS: { id: ReportPeriod; label: string; icon: string; short: string }[] = [
  { id: 'daily', label: 'Daily', icon: '📅', short: 'D' },
  { id: 'weekly', label: 'Weekly', icon: '📊', short: 'W' },
  { id: 'monthly', label: 'Monthly', icon: '📈', short: 'M' },
  { id: 'quarterly', label: 'Quarterly', icon: '📋', short: 'Q' },
  { id: 'annual', label: 'Annual', icon: '🏆', short: 'Y' },
];

const PERIOD_DESCRIPTIONS: Record<ReportPeriod, string> = {
  daily: 'Micro awareness — stop leaks early',
  weekly: 'Behavior pattern review',
  monthly: 'Your most important decision-making layer',
  quarterly: 'Strategic financial review',
  annual: 'Wealth perspective & trajectory',
};

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };
const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.07 } } },
  item: { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } },
};

export default function EnhancedReports({
  transactions, accounts, categories, budgets, savingsGoals = []
}: EnhancedReportsProps) {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const { settings, updateSettings } = useSettings();
  const viewMode = settings.report_view_mode || 'simple';
  const setViewMode = (m: 'simple' | 'detailed') => updateSettings({ report_view_mode: m });

  const data = useReportData(transactions, accounts, categories, budgets, savingsGoals, period);

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Description', 'Account'];
    const rows = data.currentTxns.map(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const acc = accounts.find(a => a.id === t.account_id);
      return [t.date, t.type, t.amount.toString(), t.currency, cat?.name || '', t.description || '', acc?.name || ''];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `finflow-${period}-${todayInTz()}.csv`;
    link.click();
    toast.success('CSV exported!');
  };

  const exportSummary = () => {
    const summary = `FinFlow 2026 — ${PERIODS.find(p => p.id === period)?.label} Report
Generated: ${format(new Date(), 'PPpp')}

═══ SUMMARY ═══
Income: ${formatCurrency(data.current.income)}
Expenses: ${formatCurrency(data.current.expense)}
Net: ${formatCurrency(data.current.net)}
Savings Rate: ${data.current.savingsRate.toFixed(1)}%

═══ vs LAST PERIOD ═══
Income: ${data.changes.income >= 0 ? '+' : ''}${data.changes.income.toFixed(1)}%
Expenses: ${data.changes.expense >= 0 ? '+' : ''}${data.changes.expense.toFixed(1)}%

═══ CATEGORIES ═══
${data.categoryBreakdown.slice(0, 5).map((c, i) => `${i + 1}. ${c.name}: ${formatCurrency(c.value)} (${c.pctOfTotal.toFixed(0)}%)`).join('\n')}

═══ BUDGETS ═══
${data.budgetPerformance.map(b => `${b.name} (${b.period}): ${formatCurrency(b.spent)}/${formatCurrency(b.budgeted)} (${b.percentage.toFixed(0)}%)${b.isOver ? ' ⚠️ OVER' : ''}`).join('\n')}

═══ HEALTH SCORE ═══
Score: ${data.healthScore}/100
Trajectory: ${data.trajectory}

═══ ACCOUNTS ═══
${accounts.map(a => `${a.name} (${a.type}): ${formatCurrency(Number(a.balance), a.currency)}`).join('\n')}
Net Worth: ${formatCurrency(data.netWorth)}

═══ ACTION ITEMS ═══
${data.actionItems.map((a, i) => `${i + 1}. ${a}`).join('\n')}
    `.trim();
    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `finflow-summary-${todayInTz()}.txt`;
    link.click();
    toast.success('Summary exported!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">Financial Reports</h2>
              <p className="text-[10px] text-muted-foreground">{PERIOD_DESCRIPTIONS[period]}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Simple / Detailed toggle */}
            <LayoutGroup id="report-view-mode">
              <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/50 backdrop-blur-sm">
                {(['simple', 'detailed'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`relative px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors duration-200 ${
                      viewMode === m ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {viewMode === m && (
                      <motion.div layoutId="report-view-pill" className="absolute inset-0 bg-primary rounded-lg shadow-sm" transition={spring} />
                    )}
                    <span className="relative z-10 flex items-center gap-1">
                      {m === 'simple' ? <Zap className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                      <span className="capitalize">{m}</span>
                    </span>
                  </button>
                ))}
              </div>
            </LayoutGroup>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportSummary} className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Summary
            </Button>
          </div>
        </div>

        {/* Period Selector — pill tabs with spring indicator */}
        <LayoutGroup>
          <div className="flex gap-1 p-1 rounded-2xl bg-muted/40 border border-border/50 w-fit backdrop-blur-sm">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`relative px-4 py-2 text-xs font-semibold rounded-xl transition-colors duration-200 ${
                  period === p.id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {period === p.id && (
                  <motion.div
                    layoutId="report-period-pill"
                    className="absolute inset-0 bg-primary rounded-xl shadow-md"
                    transition={spring}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <span className="hidden sm:inline text-sm">{p.icon}</span>
                  <span className="hidden sm:inline">{p.label}</span>
                  <span className="sm:hidden">{p.short}</span>
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </motion.div>

      {/* Report Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={period}
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="space-y-5"
        >
          {/* 1. Summary Cards */}
          <motion.div variants={stagger.item}>
            <SummaryCards
              income={data.current.income} expense={data.current.expense}
              net={data.current.net} savingsRate={data.current.savingsRate}
              changes={data.changes} periodLabel={PERIODS.find(p => p.id === period)?.label || ''}
            />
          </motion.div>

          {/* 1b. Debt Activity (if any loan disbursements/repayments this period) */}
          {(data.debtActivity.disbursed > 0 || data.debtActivity.repaid > 0) && (
            <motion.div variants={stagger.item}>
              <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <TrendingDown className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Debt Activity</p>
                        <p className="text-[9px] text-muted-foreground">Excluded from income/expense totals</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      data.debtActivity.net >= 0 ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income'
                    }`}>
                      Net {data.debtActivity.net >= 0 ? '+' : ''}{formatCurrency(data.debtActivity.net)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2.5 rounded-lg bg-expense/5 border border-expense/10">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingDown className="w-3 h-3 text-expense" />
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Borrowed</span>
                      </div>
                      <p className="text-sm font-bold font-mono text-expense">{formatCurrency(data.debtActivity.disbursed)}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-income/5 border border-income/10">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="w-3 h-3 text-income" />
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Repaid</span>
                      </div>
                      <p className="text-sm font-bold font-mono text-income">{formatCurrency(data.debtActivity.repaid)}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/30">
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Status</span>
                      </div>
                      <p className="text-sm font-bold">
                        {data.debtActivity.net > 0 ? 'Borrowing' : data.debtActivity.net < 0 ? 'Paying Down' : 'Balanced'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 2. Trend Charts */}
          <motion.div variants={stagger.item}>
            <TrendChart data={data.trendData} />
          </motion.div>

          {/* 3. Category + Budget — side by side */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CategoryBreakdown data={data.categoryBreakdown} />
            <BudgetAnalysis data={data.budgetPerformance} />
          </motion.div>

          {/* 4. Health + Forecast + Savings — DETAILED ONLY */}
          {viewMode === 'detailed' && (
            <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <HealthScoreCard score={data.healthScore} trajectory={data.trajectory} multiTrends={data.multiTrends} />
              <ForecastPanel forecast={data.forecast} netWorth={data.netWorth} />
              <SavingsAndGoals savingsGoals={savingsGoals} savingsProgress={data.savingsProgress} netWorth={data.netWorth} />
            </motion.div>
          )}

          {/* 5. Account + Top Expenses — DETAILED ONLY */}
          {viewMode === 'detailed' && (
            <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <AccountBreakdownCard accounts={accounts} breakdown={data.accountBreakdown} fixedVsVariable={data.fixedVsVariable} />
              <TopExpenses expenses={data.topExpenses} categories={categories} />
            </motion.div>
          )}

          {/* 6. Action Box */}
          <motion.div variants={stagger.item}>
            <ActionBox items={data.actionItems} spendingSpike={data.spendingSpike} />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
