import { useMemo } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Heart, TrendingDown, TrendingUp, AlertCircle, CheckCircle, ShieldCheck, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { motion } from 'framer-motion';
import type { Account, Transaction, Budget, SavingsGoal } from '@/types/finance';

interface FinancialHealthScoreProps {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
}

interface HealthFactor {
  name: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'poor';
  tip: string;
}

export default function FinancialHealthScore({ accounts, transactions, budgets, savingsGoals }: FinancialHealthScoreProps) {
  const { settings } = useSettings();

  const healthAnalysis = useMemo(() => {
    const factors: HealthFactor[] = [];
    const now = new Date();
    const wSavings = settings.health_weight_savings;
    const wDebt = settings.health_weight_debt;
    const wInvestments = settings.health_weight_investments;
    const wCashflow = settings.health_weight_cashflow;

    // Current & previous month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const thisMonth = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd);
    const lastMonth = transactions.filter(t => t.date >= prevStart && t.date <= prevEnd);

    const thisIncome = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const thisExpenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const lastIncome = lastMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const lastExpenses = lastMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    // ── Factor 1: Savings Rate ──
    const savingsRate = thisIncome > 0 ? ((thisIncome - thisExpenses) / thisIncome) * 100 : 0;
    let savingsScore = 0, savingsStatus: 'good' | 'warning' | 'poor' = 'poor', savingsTip = '';
    if (savingsRate >= 20) { savingsScore = wSavings; savingsStatus = 'good'; savingsTip = `Excellent! Saving ${savingsRate.toFixed(0)}% of income.`; }
    else if (savingsRate >= 10) { savingsScore = wSavings * 0.6; savingsStatus = 'warning'; savingsTip = `Saving ${savingsRate.toFixed(0)}%. Aim for 20%.`; }
    else if (savingsRate > 0) { savingsScore = wSavings * 0.3; savingsStatus = 'warning'; savingsTip = `Only saving ${savingsRate.toFixed(0)}%. Target 10-20%.`; }
    else { savingsScore = 0; savingsStatus = 'poor'; savingsTip = 'Spending exceeds income. Review expenses.'; }
    factors.push({ name: 'Savings Rate', score: Math.round(savingsScore), maxScore: wSavings, status: savingsStatus, tip: savingsTip });

    // ── Factor 2: Budget Discipline ──
    let budgetScore = 0, budgetStatus: 'good' | 'warning' | 'poor' = 'poor', budgetTip = '';
    if (budgets.length === 0) { budgetScore = wDebt * 0.2; budgetStatus = 'warning'; budgetTip = 'Set up budgets to track spending.'; }
    else {
      const overBudgetCount = budgets.filter(b => {
        const spent = thisMonth.filter(t => t.type === 'expense' && t.category_id === b.category_id).reduce((s, t) => s + Number(t.amount), 0);
        return spent > Number(b.amount);
      }).length;
      const adherenceRate = (budgets.length - overBudgetCount) / budgets.length;
      if (adherenceRate >= 0.9) { budgetScore = wDebt; budgetStatus = 'good'; budgetTip = 'Great budget discipline!'; }
      else if (adherenceRate >= 0.7) { budgetScore = wDebt * 0.7; budgetStatus = 'warning'; budgetTip = 'Most budgets on track. Review over-budget ones.'; }
      else { budgetScore = wDebt * 0.3; budgetStatus = 'poor'; budgetTip = 'Multiple budgets exceeded. Cut expenses.'; }
    }
    factors.push({ name: 'Budget Discipline', score: Math.round(budgetScore), maxScore: wDebt, status: budgetStatus, tip: budgetTip });

    // ── Factor 3: Emergency Fund Coverage ──
    const totalBalance = accounts.filter(a => a.is_active).reduce((s, a) => s + Number(a.balance), 0);
    const monthlyExpenseAvg = thisExpenses > 0 ? thisExpenses : lastExpenses;
    const emergencyMonths = monthlyExpenseAvg > 0 ? totalBalance / monthlyExpenseAvg : 0;
    let efScore = 0, efStatus: 'good' | 'warning' | 'poor' = 'poor', efTip = '';
    if (emergencyMonths >= 6) { efScore = wInvestments; efStatus = 'good'; efTip = `${emergencyMonths.toFixed(1)} months of expenses covered. Excellent safety net.`; }
    else if (emergencyMonths >= 3) { efScore = wInvestments * 0.6; efStatus = 'warning'; efTip = `${emergencyMonths.toFixed(1)} months covered. Aim for 6 months.`; }
    else if (emergencyMonths >= 1) { efScore = wInvestments * 0.3; efStatus = 'warning'; efTip = `Only ${emergencyMonths.toFixed(1)} months covered. Build your emergency fund.`; }
    else { efScore = 0; efStatus = 'poor'; efTip = 'No emergency fund buffer. Prioritize savings.'; }
    factors.push({ name: 'Emergency Fund', score: Math.round(efScore), maxScore: wInvestments, status: efStatus, tip: efTip });

    // ── Factor 4: Expense Stability ──
    const halfWeight = Math.round(wCashflow / 2);
    let stabilityScore = 0, stabilityStatus: 'good' | 'warning' | 'poor' = 'poor', stabilityTip = '';
    if (lastExpenses > 0 && thisExpenses > 0) {
      const volatility = Math.abs(thisExpenses - lastExpenses) / lastExpenses * 100;
      if (volatility < 15) { stabilityScore = halfWeight; stabilityStatus = 'good'; stabilityTip = 'Spending is stable and predictable.'; }
      else if (volatility < 30) { stabilityScore = halfWeight * 0.6; stabilityStatus = 'warning'; stabilityTip = `Spending varies ${volatility.toFixed(0)}% month-to-month.`; }
      else { stabilityScore = halfWeight * 0.2; stabilityStatus = 'poor'; stabilityTip = `High spending volatility (${volatility.toFixed(0)}%). Create a consistent budget.`; }
    } else {
      stabilityScore = halfWeight * 0.2; stabilityStatus = 'warning'; stabilityTip = 'Need more data for stability analysis.';
    }
    factors.push({ name: 'Expense Stability', score: Math.round(stabilityScore), maxScore: halfWeight, status: stabilityStatus, tip: stabilityTip });

    // ── Factor 5: Goals & Tracking ──
    const remainingWeight = wCashflow - halfWeight;
    let goalsScore = 0, goalsStatus: 'good' | 'warning' | 'poor' = 'poor', goalsTip = '';
    if (savingsGoals.length === 0) { goalsScore = remainingWeight * 0.2; goalsStatus = 'warning'; goalsTip = 'Set savings goals for better financial planning.'; }
    else {
      const avgProgress = savingsGoals.reduce((s, g) => s + (Number(g.current_amount) / Number(g.target_amount)) * 100, 0) / savingsGoals.length;
      if (avgProgress >= 50) { goalsScore = remainingWeight; goalsStatus = 'good'; goalsTip = 'Great goal progress!'; }
      else if (avgProgress >= 25) { goalsScore = remainingWeight * 0.6; goalsStatus = 'warning'; goalsTip = 'Keep contributing to goals.'; }
      else { goalsScore = remainingWeight * 0.3; goalsStatus = 'warning'; goalsTip = 'Goals need more contributions.'; }
    }
    factors.push({ name: 'Goals Progress', score: Math.round(goalsScore), maxScore: remainingWeight, status: goalsStatus, tip: goalsTip });

    const totalScore = factors.reduce((s, f) => s + f.score, 0);
    const maxPossibleScore = factors.reduce((s, f) => s + f.maxScore, 0);

    // Trend: compare last month's equivalent score
    const lastSavingsRate = lastIncome > 0 ? ((lastIncome - lastExpenses) / lastIncome) * 100 : 0;
    const trend = savingsRate > lastSavingsRate ? 'up' : savingsRate < lastSavingsRate ? 'down' : 'flat';

    return { factors, totalScore, maxPossibleScore, trend, emergencyMonths, savingsRate };
  }, [accounts, transactions, budgets, savingsGoals, settings]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-income';
    if (score >= 50) return 'text-[hsl(var(--warning))]';
    return 'text-expense';
  };

  const getGrade = (score: number) => {
    if (score >= 90) return { label: 'A+', desc: 'Excellent' };
    if (score >= 80) return { label: 'A', desc: 'Very Good' };
    if (score >= 70) return { label: 'B', desc: 'Good' };
    if (score >= 60) return { label: 'B-', desc: 'Above Average' };
    if (score >= 50) return { label: 'C', desc: 'Fair' };
    if (score >= 40) return { label: 'D', desc: 'Needs Work' };
    return { label: 'F', desc: 'Critical' };
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'poor') => {
    if (status === 'good') return <CheckCircle className="w-3.5 h-3.5 text-income" />;
    if (status === 'warning') return <AlertCircle className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />;
    return <TrendingDown className="w-3.5 h-3.5 text-expense" />;
  };

  const pct = (healthAnalysis.totalScore / healthAnalysis.maxPossibleScore) * 100;
  const grade = getGrade(pct);

  // SVG ring
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * Math.min(pct, 100)) / 100;

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="w-6 h-6 rounded-lg bg-expense/10 flex items-center justify-center">
            <Heart className="w-3 h-3 text-expense" />
          </div>
          Financial Health
          <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">Score</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero: Score Ring + Grade */}
        <div className="flex items-center gap-5">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 108 108" className="w-full h-full -rotate-90">
              <circle cx="54" cy="54" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
              <motion.circle
                cx="54" cy="54" r={radius}
                fill="none"
                stroke={pct >= 75 ? 'hsl(var(--income))' : pct >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--expense))'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className={`text-2xl font-black font-mono ${getScoreColor(pct)}`}
              >{healthAnalysis.totalScore}</motion.span>
              <span className="text-[8px] text-muted-foreground">/ {healthAnalysis.maxPossibleScore}</span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${getScoreColor(pct)}`}>{grade.label}</span>
              <span className="text-xs text-muted-foreground">{grade.desc}</span>
              {healthAnalysis.trend === 'up' && <TrendingUp className="w-4 h-4 text-income" />}
              {healthAnalysis.trend === 'down' && <TrendingDown className="w-4 h-4 text-expense" />}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-muted/20">
                <div className="flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5 text-primary" />
                  <span className="text-[8px] text-muted-foreground">Save Rate</span>
                </div>
                <p className={`text-[11px] font-bold font-mono ${healthAnalysis.savingsRate >= 20 ? 'text-income' : 'text-[hsl(var(--warning))]'}`}>{healthAnalysis.savingsRate.toFixed(0)}%</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/20">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                  <span className="text-[8px] text-muted-foreground">Emergency</span>
                </div>
                <p className={`text-[11px] font-bold font-mono ${healthAnalysis.emergencyMonths >= 3 ? 'text-income' : 'text-expense'}`}>{healthAnalysis.emergencyMonths.toFixed(1)}mo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Factor breakdown */}
        <div className="space-y-2">
          {healthAnalysis.factors.map((factor, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              className="p-2.5 rounded-xl bg-muted/20"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(factor.status)}
                  <span className="text-[11px] font-semibold">{factor.name}</span>
                </div>
                <span className="text-[10px] font-mono font-bold">{factor.score}/{factor.maxScore}</span>
              </div>
              <Progress value={(factor.score / factor.maxScore) * 100} className="h-1.5 mb-1" />
              <p className="text-[9px] text-muted-foreground">{factor.tip}</p>
            </motion.div>
          ))}
        </div>

        <p className="text-[9px] text-muted-foreground text-center">Weights configurable in Settings → Financial Rules</p>
      </CardContent>
    </Card>
  );
}
