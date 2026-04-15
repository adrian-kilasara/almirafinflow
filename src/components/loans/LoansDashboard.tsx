import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { TrendingDown, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import LoanCard from './LoanCard';
import LoanForm from './LoanForm';
import LoanDetailPanel from './LoanDetailPanel';
import type { Account } from '@/types/finance';

interface LoansDashboardProps {
  accounts: Account[];
  onRefresh: () => void;
}

export default function LoansDashboard({ accounts, onRefresh }: LoansDashboardProps) {
  const [selectedLoan, setSelectedLoan] = useState<Account | null>(null);

  const loans = useMemo(() =>
    accounts.filter(a => a.classification === 'liability' && !a.is_archived),
    [accounts]
  );

  const totalDebt = loans.reduce((s, l) => s + Number(l.balance), 0);
  const totalOriginal = loans.reduce((s, l) => s + Number(l.opening_balance), 0);
  const totalPaid = totalOriginal - totalDebt;
  const monthlyObligations = loans.reduce((s, l) => s + (Number((l as any).monthly_payment) || 0), 0);

  const overdueLoanCount = loans.filter(l => {
    const startDate = (l as any).loan_start_date;
    const termMonths = (l as any).loan_term_months;
    if (!startDate || !termMonths) return false;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + termMonths);
    return endDate < new Date() && Number(l.balance) > 0;
  }).length;

  if (selectedLoan) {
    // Re-fetch the latest version of the loan from accounts
    const freshLoan = accounts.find(a => a.id === selectedLoan.id) || selectedLoan;
    return (
      <LoanDetailPanel
        loan={freshLoan}
        onBack={() => setSelectedLoan(null)}
        onRefresh={onRefresh}
      />
    );
  }

  const staggerItem = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-expense/10 border border-expense/20 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-expense" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Loans & Debt</h2>
            <p className="text-[10px] text-muted-foreground">Track and manage all your loans</p>
          </div>
        </div>
        <LoanForm accounts={accounts} onSuccess={onRefresh} />
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <motion.div variants={staggerItem}>
          <Card className="border-expense/20 bg-expense/5">
            <CardContent className="p-3 text-center">
              <DollarSign className="w-4 h-4 mx-auto mb-1 text-expense" />
              <p className="text-lg font-extrabold font-mono text-expense">{formatCurrency(totalDebt)}</p>
              <p className="text-[9px] text-muted-foreground">Total Debt</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className="border-income/20 bg-income/5">
            <CardContent className="p-3 text-center">
              <TrendingDown className="w-4 h-4 mx-auto mb-1 text-income" />
              <p className="text-lg font-extrabold font-mono text-income">{formatCurrency(totalPaid)}</p>
              <p className="text-[9px] text-muted-foreground">Total Repaid</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className="border-border/40 bg-card/60">
            <CardContent className="p-3 text-center">
              <Calendar className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-extrabold font-mono">{formatCurrency(monthlyObligations)}</p>
              <p className="text-[9px] text-muted-foreground">Monthly Payments</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className={`border-border/40 ${overdueLoanCount > 0 ? 'border-warning/30 bg-warning/5' : 'bg-card/60'}`}>
            <CardContent className="p-3 text-center">
              <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${overdueLoanCount > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
              <p className="text-lg font-extrabold">{loans.length}</p>
              <p className="text-[9px] text-muted-foreground">Active Loans{overdueLoanCount > 0 ? ` (${overdueLoanCount} overdue)` : ''}</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Loan Cards */}
      {loans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} onSelect={setSelectedLoan} />
          ))}
        </div>
      ) : (
        <Card className="border-border/30 bg-card/40">
          <CardContent className="p-12 text-center">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 text-muted-foreground/15" />
            <h3 className="text-sm font-bold mb-1">No Loans Yet</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Add your loans to track repayment progress and see how they affect your net worth.
            </p>
            <LoanForm accounts={accounts} onSuccess={onRefresh} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
