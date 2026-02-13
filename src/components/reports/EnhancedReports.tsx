import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { BarChart3, FileText, Table as TableIcon } from 'lucide-react';
import type { Transaction, Account, Category, Budget, SavingsGoal } from '@/types/finance';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useReportData, type ReportPeriod } from './hooks/useReportData';

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

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
};

const PERIOD_DESCRIPTIONS: Record<ReportPeriod, string> = {
  daily: 'Micro awareness — stop leaks early',
  weekly: 'Behavior pattern review',
  monthly: 'Your most important decision-making layer',
  quarterly: 'Strategic financial review',
  annual: 'Wealth perspective & trajectory',
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
    const summary = `FinFlow 2026 — ${PERIOD_LABELS[period]} Report
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Financial Reports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_DESCRIPTIONS[period]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['daily', 'weekly', 'monthly', 'quarterly', 'annual'] as ReportPeriod[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV}><TableIcon className="w-3.5 h-3.5 mr-1" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportSummary}><FileText className="w-3.5 h-3.5 mr-1" />Summary</Button>
        </div>
      </div>

      {/* 1. Summary Cards */}
      <SummaryCards
        income={data.current.income} expense={data.current.expense}
        net={data.current.net} savingsRate={data.current.savingsRate}
        changes={data.changes} periodLabel={PERIOD_LABELS[period]}
      />

      {/* 2. Trend Charts */}
      <TrendChart data={data.trendData} />

      {/* 3. Category + Budget + Health row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdown data={data.categoryBreakdown} />
        <BudgetAnalysis data={data.budgetPerformance} />
      </div>

      {/* 4. Health + Forecast + Savings row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HealthScoreCard score={data.healthScore} trajectory={data.trajectory} multiTrends={data.multiTrends} />
        <ForecastPanel forecast={data.forecast} netWorth={data.netWorth} />
        <SavingsAndGoals savingsGoals={savingsGoals} savingsProgress={data.savingsProgress} netWorth={data.netWorth} />
      </div>

      {/* 5. Account Breakdown + Top Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AccountBreakdownCard accounts={accounts} breakdown={data.accountBreakdown} fixedVsVariable={data.fixedVsVariable} />
        <TopExpenses expenses={data.topExpenses} categories={categories} />
      </div>

      {/* 6. Action Box — the most important section */}
      <ActionBox items={data.actionItems} spendingSpike={data.spendingSpike} />
    </div>
  );
}
