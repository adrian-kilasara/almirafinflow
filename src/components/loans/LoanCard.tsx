import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/format';
import { Calendar, Percent, Clock, ChevronRight, PlusCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Account } from '@/types/finance';

interface LoanCardProps {
  loan: Account;
  onSelect: (loan: Account) => void;
  onTopUp?: (loan: Account) => void;
}

export default function LoanCard({ loan, onSelect, onTopUp }: LoanCardProps) {
  const originalAmount = Number(loan.opening_balance);
  const currentBalance = Number(loan.balance);
  const paidAmount = originalAmount - currentBalance;
  const paidPercentage = originalAmount > 0 ? Math.round((paidAmount / originalAmount) * 100) : 0;
  
  const loanType = (loan as any).loan_type || loan.type;
  const interestRate = (loan as any).interest_rate;
  const monthlyPayment = (loan as any).monthly_payment;
  const loanTermMonths = (loan as any).loan_term_months;
  const loanStartDate = (loan as any).loan_start_date;

  const getNextPaymentDate = () => {
    if (!loanStartDate || !loanTermMonths) return null;
    const start = new Date(loanStartDate);
    const now = new Date();
    let next = new Date(start);
    while (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  };

  const nextPayment = getNextPaymentDate();
  const daysUntilPayment = nextPayment
    ? Math.ceil((nextPayment.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const loanTypeLabels: Record<string, string> = {
    bank: 'Bank Loan',
    mobile_money: 'Mobile Loan',
    other: 'Other Loan',
    personal: 'Personal',
    mortgage: 'Mortgage',
    business: 'Business',
    mobile: 'Mobile',
    informal: 'Informal',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className="border-border/40 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-all cursor-pointer group"
        onClick={() => onSelect(loan)}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
                style={{ backgroundColor: loan.color ? `${loan.color}20` : 'hsl(var(--expense)/0.1)' }}
              >
                {loan.icon || '🏦'}
              </div>
              <div>
                <p className="text-sm font-bold truncate max-w-[140px]">{loan.name}</p>
                <p className="text-[10px] text-muted-foreground">{loanTypeLabels[loanType] || loanType}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[9px] border-expense/30 text-expense">
              {loan.currency}
            </Badge>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-lg font-extrabold font-mono text-expense">
                {formatCurrency(currentBalance, loan.currency)}
              </p>
              <p className="text-[10px] text-muted-foreground">{paidPercentage}% paid</p>
            </div>
            <Progress value={paidPercentage} className="h-1.5" />
            <div className="flex justify-between mt-1">
              <p className="text-[9px] text-muted-foreground">
                Paid: {formatCurrency(paidAmount, loan.currency)}
              </p>
              <p className="text-[9px] text-muted-foreground">
                Total: {formatCurrency(originalAmount, loan.currency)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/30">
            {interestRate != null && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-0.5 text-muted-foreground mb-0.5">
                  <Percent className="w-2.5 h-2.5" />
                </div>
                <p className="text-[10px] font-bold">{interestRate}%</p>
                <p className="text-[8px] text-muted-foreground">Rate</p>
              </div>
            )}
            {monthlyPayment != null && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-0.5 text-muted-foreground mb-0.5">
                  <Calendar className="w-2.5 h-2.5" />
                </div>
                <p className="text-[10px] font-bold font-mono">{formatCurrency(monthlyPayment, loan.currency)}</p>
                <p className="text-[8px] text-muted-foreground">Monthly</p>
              </div>
            )}
            {daysUntilPayment != null && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-0.5 text-muted-foreground mb-0.5">
                  <Clock className="w-2.5 h-2.5" />
                </div>
                <p className={`text-[10px] font-bold ${daysUntilPayment <= 7 ? 'text-warning' : ''}`}>
                  {daysUntilPayment}d
                </p>
                <p className="text-[8px] text-muted-foreground">Next Due</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            {onTopUp && (
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-6 px-2 gap-1 rounded-full border-primary/30 text-primary hover:bg-primary/10"
                onClick={(e) => { e.stopPropagation(); onTopUp(loan); }}
              >
                <PlusCircle className="w-3 h-3" /> Borrow More
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 gap-1 text-primary hover:bg-primary/10 rounded-full group-hover:translate-x-0.5 transition-transform ml-auto">
              Details <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
