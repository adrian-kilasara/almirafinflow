import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { BarChart3, FileText, Table as TableIcon, Download, Calendar, ArrowRight } from 'lucide-react';
import type { Transaction, Account, Category, Budget, SavingsGoal } from '@/types/finance';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useReportData, type ReportPeriod } from './hooks/useReportData';
import { motion, AnimatePresence } from 'framer-motion';

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

const PERIODS: { id: ReportPeriod; label: string; icon: string }[] = [
  { id: 'daily', label: 'Daily', icon: '📅' },
  { id: 'weekly', label: 'Weekly', icon: '📊' },
  { id: 'monthly', label: 'Monthly', icon: '📈' },
  { id: 'quarterly', label: 'Quarterly', icon: '📋' },
  { id: 'annual', label: 'Annual', icon: '🏆' },
];

const PERIOD_DESCRIPTIONS: Record<ReportPeriod, string> = {
  daily: 'Micro awareness — stop leaks early',
  weekly: 'Behavior pattern review',
  monthly: 'Your most important decision-making layer',
  quarterly: 'Strategic financial review',
  annual: 'Wealth perspective & trajectory',
};

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } },
};

export default function EnhancedReports({
  transactions, accounts, categories, budgets, savingsGoals = []
}: EnhancedReportsProps) {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');

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
    link.download = `finflow-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
    link.download = `finflow-summary-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    link.click();
    toast.success('Summary exported!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Financial Reports</h2>
              <p className="text-xs text-muted-foreground">{PERIOD_DESCRIPTIONS[period]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV} className="rounded-xl gap-1.5">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportSummary} className="rounded-xl gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Summary
            </Button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border w-fit">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`relative px-3 py-2 text-xs font-medium rounded-xl transition-colors duration-200 ${
                period === p.id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {period === p.id && (
                <motion.div
                  layoutId="report-period-bg"
                  className="absolute inset-0 bg-primary rounded-xl"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <span className="hidden sm:inline">{p.icon}</span>
                {p.label}
              </span>
            </button>
          ))}
        </div>
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

          {/* 2. Trend Charts */}
          <motion.div variants={stagger.item}>
            <TrendChart data={data.trendData} />
          </motion.div>

          {/* 3. Category + Budget */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CategoryBreakdown data={data.categoryBreakdown} />
            <BudgetAnalysis data={data.budgetPerformance} />
          </motion.div>

          {/* 4. Health + Forecast + Savings */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <HealthScoreCard score={data.healthScore} trajectory={data.trajectory} multiTrends={data.multiTrends} />
            <ForecastPanel forecast={data.forecast} netWorth={data.netWorth} />
            <SavingsAndGoals savingsGoals={savingsGoals} savingsProgress={data.savingsProgress} netWorth={data.netWorth} />
          </motion.div>

          {/* 5. Account + Top Expenses */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AccountBreakdownCard accounts={accounts} breakdown={data.accountBreakdown} fixedVsVariable={data.fixedVsVariable} />
            <TopExpenses expenses={data.topExpenses} categories={categories} />
          </motion.div>

          {/* 6. Action Box */}
          <motion.div variants={stagger.item}>
            <ActionBox items={data.actionItems} spendingSpike={data.spendingSpike} />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
