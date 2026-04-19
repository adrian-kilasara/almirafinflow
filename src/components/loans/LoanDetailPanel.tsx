import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatDate } from '@/lib/format';
import { ArrowLeft, Calendar, Percent, Clock, DollarSign, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import LoanPaymentForm from './LoanPaymentForm';
import type { Account } from '@/types/finance';

interface LoanPayment {
  id: string;
  amount: number;
  principal_portion: number;
  interest_portion: number;
  payment_date: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface LoanDetailPanelProps {
  loan: Account;
  onBack: () => void;
  onRefresh: () => void;
}

export default function LoanDetailPanel({ loan, onBack, onRefresh }: LoanDetailPanelProps) {
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const originalAmount = Number(loan.opening_balance);
  const currentBalance = Number(loan.balance);
  const paidAmount = originalAmount - currentBalance;
  const paidPercentage = originalAmount > 0 ? Math.round((paidAmount / originalAmount) * 100) : 0;
  const interestRate = (loan as any).interest_rate;
  const loanTermMonths = (loan as any).loan_term_months;
  const monthlyPayment = (loan as any).monthly_payment;
  const loanStartDate = (loan as any).loan_start_date;

  useEffect(() => {
    fetchPayments();
  }, [loan.id]);

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loan_payments')
      .select('*')
      .eq('loan_account_id', loan.id)
      .order('payment_date', { ascending: false });
    if (data) setPayments(data as any);
    setLoading(false);
  };

  const totalPrincipalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.principal_portion), 0);
  const totalInterestPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.interest_portion), 0);

  // Simple amortization projection
  const generateAmortization = () => {
    if (!monthlyPayment || !interestRate || currentBalance <= 0) return [];
    const monthlyRate = interestRate / 100 / 12;
    const schedule: { month: number; payment: number; principal: number; interest: number; remaining: number }[] = [];
    let remaining = currentBalance;
    let month = 0;
    while (remaining > 0 && month < 360) {
      month++;
      const interestPart = remaining * monthlyRate;
      const principalPart = Math.min(remaining, monthlyPayment - interestPart);
      remaining = Math.max(0, remaining - principalPart);
      schedule.push({
        month,
        payment: monthlyPayment,
        principal: principalPart,
        interest: interestPart,
        remaining,
      });
    }
    return schedule;
  };

  const amortization = generateAmortization();
  const projectedPayoffMonths = amortization.length;
  const totalProjectedInterest = amortization.reduce((s, r) => s + r.interest, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ backgroundColor: loan.color ? `${loan.color}20` : 'hsl(var(--expense)/0.1)' }}
          >
            {loan.icon || '🏦'}
          </div>
          <div>
            <h2 className="text-lg font-extrabold">{loan.name}</h2>
            <p className="text-[10px] text-muted-foreground">{loan.institution_name || (loan as any).loan_type || 'Loan'}</p>
          </div>
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowPaymentForm(true)} className="bg-expense hover:bg-expense/90">
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-3 text-center">
            <DollarSign className="w-4 h-4 mx-auto mb-1 text-expense" />
            <p className="text-lg font-extrabold font-mono text-expense">{formatCurrency(currentBalance, loan.currency)}</p>
            <p className="text-[9px] text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-3 text-center">
            <TrendingDown className="w-4 h-4 mx-auto mb-1 text-income" />
            <p className="text-lg font-extrabold font-mono text-income">{formatCurrency(paidAmount, loan.currency)}</p>
            <p className="text-[9px] text-muted-foreground">Total Paid</p>
          </CardContent>
        </Card>
        {interestRate != null && (
          <Card className="border-border/40 bg-card/60">
            <CardContent className="p-3 text-center">
              <Percent className="w-4 h-4 mx-auto mb-1 text-warning" />
              <p className="text-lg font-extrabold">{interestRate}%</p>
              <p className="text-[9px] text-muted-foreground">Interest Rate</p>
            </CardContent>
          </Card>
        )}
        {projectedPayoffMonths > 0 && (
          <Card className="border-border/40 bg-card/60">
            <CardContent className="p-3 text-center">
              <Clock className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-extrabold">{projectedPayoffMonths}</p>
              <p className="text-[9px] text-muted-foreground">Months to Payoff</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Progress */}
      <Card className="border-border/40 bg-card/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold">Repayment Progress</p>
            <p className="text-xs font-bold text-primary">{paidPercentage}%</p>
          </div>
          <Progress value={paidPercentage} className="h-2.5 mb-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Paid: {formatCurrency(paidAmount, loan.currency)}</span>
            <span>Remaining: {formatCurrency(currentBalance, loan.currency)}</span>
          </div>
          {totalInterestPaid > 0 && (
            <p className="text-[10px] text-warning mt-1">
              Total interest paid: {formatCurrency(totalInterestPaid, loan.currency)}
            </p>
          )}
          {totalProjectedInterest > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Projected remaining interest: {formatCurrency(totalProjectedInterest, loan.currency)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Amortization Preview */}
      {amortization.length > 0 && (
        <Card className="border-border/40 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Amortization Schedule (Next 6 months)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left py-1.5 pr-3">Month</th>
                    <th className="text-right py-1.5 pr-3">Payment</th>
                    <th className="text-right py-1.5 pr-3">Principal</th>
                    <th className="text-right py-1.5 pr-3">Interest</th>
                    <th className="text-right py-1.5">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {amortization.slice(0, 6).map((row) => (
                    <tr key={row.month} className="border-b border-border/10">
                      <td className="py-1.5 pr-3 font-mono">{row.month}</td>
                      <td className="text-right py-1.5 pr-3 font-mono">{formatCurrency(row.payment, loan.currency)}</td>
                      <td className="text-right py-1.5 pr-3 font-mono text-income">{formatCurrency(row.principal, loan.currency)}</td>
                      <td className="text-right py-1.5 pr-3 font-mono text-warning">{formatCurrency(row.interest, loan.currency)}</td>
                      <td className="text-right py-1.5 font-mono">{formatCurrency(row.remaining, loan.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card className="border-border/40 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />)}
            </div>
          ) : payments.length > 0 ? (
            <div className="space-y-2">
              {payments.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/10 hover:bg-muted/20 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === 'paid' ? 'default' : 'outline'} className="text-[8px] h-4">
                        {p.status}
                      </Badge>
                      <p className="text-[11px] font-medium">{formatDate(p.payment_date)}</p>
                    </div>
                    {p.notes && <p className="text-[9px] text-muted-foreground mt-0.5">{p.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono">{formatCurrency(Number(p.amount), loan.currency)}</p>
                    <p className="text-[8px] text-muted-foreground">
                      P: {formatCurrency(Number(p.principal_portion), loan.currency)} / I: {formatCurrency(Number(p.interest_portion), loan.currency)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">No payments recorded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <LoanPaymentForm
        loan={loan}
        open={showPaymentForm}
        onOpenChange={setShowPaymentForm}
        onSuccess={async () => {
          // Refresh payment history first so totals + progress update immediately
          await fetchPayments();
          // Then bubble up to parent so the loan.balance prop also refreshes
          onRefresh();
        }}
      />
    </div>
  );
}
