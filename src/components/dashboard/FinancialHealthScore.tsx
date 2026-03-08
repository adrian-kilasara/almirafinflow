import { useMemo } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Heart, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
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

export default function FinancialHealthScore({
  accounts, transactions, budgets, savingsGoals,
}: FinancialHealthScoreProps) {
  const { settings } = useSettings();

  const healthAnalysis = useMemo(() => {
    const factors: HealthFactor[] = [];

    // Use weights from settings (each out of 100, we normalize to the factor's max score)
    const wSavings = settings.health_weight_savings; // e.g. 30
    const wDebt = settings.health_weight_debt; // e.g. 25 → maps to budget discipline
    const wInvestments = settings.health_weight_investments; // e.g. 20 → maps to account diversification
    const wCashflow = settings.health_weight_cashflow; // e.g. 25 → maps to goals + tracking

    // Factor 1: Savings Rate (weighted by health_weight_savings)
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    let savingsScore = 0;
    let savingsStatus: 'good' | 'warning' | 'poor' = 'poor';
    let savingsTip = '';
    
    if (savingsRate >= 20) { savingsScore = wSavings; savingsStatus = 'good'; savingsTip = `Excellent! Saving ${savingsRate.toFixed(0)}% of income.`; }
    else if (savingsRate >= 10) { savingsScore = wSavings * 0.6; savingsStatus = 'warning'; savingsTip = `Saving ${savingsRate.toFixed(0)}%. Aim for 20%.`; }
    else if (savingsRate > 0) { savingsScore = wSavings * 0.3; savingsStatus = 'warning'; savingsTip = `Only saving ${savingsRate.toFixed(0)}%. Target 10-20%.`; }
    else { savingsScore = 0; savingsStatus = 'poor'; savingsTip = 'Spending exceeds income. Review expenses.'; }
    
    factors.push({ name: 'Savings Rate', score: Math.round(savingsScore), maxScore: wSavings, status: savingsStatus, tip: savingsTip });
    
    // Factor 2: Budget Discipline (weighted by health_weight_debt)
    const activeBudgets = budgets;
    let budgetScore = 0;
    let budgetStatus: 'good' | 'warning' | 'poor' = 'poor';
    let budgetTip = '';
    
    if (activeBudgets.length === 0) {
      budgetScore = wDebt * 0.2; budgetStatus = 'warning'; budgetTip = 'Set up budgets to track spending.';
    } else {
      const budgetsWithSpending = activeBudgets.map(budget => {
        const spent = transactions.filter(t => t.type === 'expense' && t.category_id === budget.category_id).reduce((sum, t) => sum + Number(t.amount), 0);
        return { overBudget: spent > Number(budget.amount) };
      });
      const overBudgetCount = budgetsWithSpending.filter(b => b.overBudget).length;
      const adherenceRate = (activeBudgets.length - overBudgetCount) / activeBudgets.length;
      
      if (adherenceRate >= 0.9) { budgetScore = wDebt; budgetStatus = 'good'; budgetTip = 'Great budget discipline!'; }
      else if (adherenceRate >= 0.7) { budgetScore = wDebt * 0.7; budgetStatus = 'warning'; budgetTip = 'Most budgets on track. Review over-budget ones.'; }
      else { budgetScore = wDebt * 0.3; budgetStatus = 'poor'; budgetTip = 'Multiple budgets exceeded. Cut expenses.'; }
    }
    
    factors.push({ name: 'Budget Discipline', score: Math.round(budgetScore), maxScore: wDebt, status: budgetStatus, tip: budgetTip });
    
    // Factor 3: Account Diversification (weighted by health_weight_investments)
    const activeAccounts = accounts.filter(a => a.is_active);
    const accountTypes = new Set(activeAccounts.map(a => a.type));
    let divScore = 0;
    let divStatus: 'good' | 'warning' | 'poor' = 'poor';
    let divTip = '';
    
    if (accountTypes.size >= 3) { divScore = wInvestments; divStatus = 'good'; divTip = 'Well-diversified accounts.'; }
    else if (accountTypes.size >= 2) { divScore = wInvestments * 0.6; divStatus = 'warning'; divTip = 'Add more account types for diversification.'; }
    else if (activeAccounts.length > 0) { divScore = wInvestments * 0.25; divStatus = 'warning'; divTip = 'Add savings/investment accounts.'; }
    else { divScore = 0; divStatus = 'poor'; divTip = 'Add accounts to start tracking.'; }
    
    factors.push({ name: 'Account Setup', score: Math.round(divScore), maxScore: wInvestments, status: divStatus, tip: divTip });
    
    // Factor 4: Goals + Tracking (weighted by health_weight_cashflow)
    const halfWeight = Math.round(wCashflow / 2);
    
    // Goals
    let goalsScore = 0;
    let goalsStatus: 'good' | 'warning' | 'poor' = 'poor';
    let goalsTip = '';
    if (savingsGoals.length === 0) { goalsScore = halfWeight * 0.2; goalsStatus = 'warning'; goalsTip = 'Set savings goals.'; }
    else {
      const avgProgress = savingsGoals.reduce((s, g) => s + (Number(g.current_amount) / Number(g.target_amount)) * 100, 0) / savingsGoals.length;
      if (avgProgress >= 50) { goalsScore = halfWeight; goalsStatus = 'good'; goalsTip = 'Great goal progress!'; }
      else if (avgProgress >= 25) { goalsScore = halfWeight * 0.6; goalsStatus = 'warning'; goalsTip = 'Keep contributing to goals.'; }
      else { goalsScore = halfWeight * 0.3; goalsStatus = 'warning'; goalsTip = 'Goals need more contributions.'; }
    }
    factors.push({ name: 'Goals Progress', score: Math.round(goalsScore), maxScore: halfWeight, status: goalsStatus, tip: goalsTip });
    
    // Tracking consistency
    const last30Days = transactions.filter(t => {
      const date = new Date(t.date);
      const ago = new Date(); ago.setDate(ago.getDate() - 30);
      return date >= ago;
    });
    const remainingWeight = wCashflow - halfWeight;
    let trackScore = 0;
    let trackStatus: 'good' | 'warning' | 'poor' = 'poor';
    let trackTip = '';
    if (last30Days.length >= 20) { trackScore = remainingWeight; trackStatus = 'good'; trackTip = 'Great tracking consistency!'; }
    else if (last30Days.length >= 10) { trackScore = remainingWeight * 0.6; trackStatus = 'warning'; trackTip = 'Log more transactions.'; }
    else if (last30Days.length > 0) { trackScore = remainingWeight * 0.3; trackStatus = 'warning'; trackTip = 'More frequent logging needed.'; }
    else { trackScore = 0; trackStatus = 'poor'; trackTip = 'Start logging transactions.'; }
    factors.push({ name: 'Tracking', score: Math.round(trackScore), maxScore: remainingWeight, status: trackStatus, tip: trackTip });
    
    const totalScore = factors.reduce((s, f) => s + f.score, 0);
    const maxPossibleScore = factors.reduce((s, f) => s + f.maxScore, 0);
    
    return { factors, totalScore, maxPossibleScore };
  }, [accounts, transactions, budgets, savingsGoals, settings]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-income';
    if (score >= 50) return 'text-[hsl(var(--warning))]';
    return 'text-expense';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 30) return 'Needs Work';
    return 'Critical';
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'poor') => {
    if (status === 'good') return <CheckCircle className="w-4 h-4 text-income" />;
    if (status === 'warning') return <AlertCircle className="w-4 h-4 text-[hsl(var(--warning))]" />;
    return <TrendingDown className="w-4 h-4 text-expense" />;
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-expense" />
          Financial Health Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className={`text-5xl font-bold ${getScoreColor(healthAnalysis.totalScore)}`}>
            {healthAnalysis.totalScore}
          </div>
          <p className="text-muted-foreground">out of {healthAnalysis.maxPossibleScore}</p>
          <p className={`text-lg font-semibold mt-2 ${getScoreColor(healthAnalysis.totalScore)}`}>
            {getScoreLabel(healthAnalysis.totalScore)}
          </p>
          <Progress value={(healthAnalysis.totalScore / healthAnalysis.maxPossibleScore) * 100} className="mt-4 h-3" />
        </div>
        <div className="space-y-3">
          {healthAnalysis.factors.map((factor, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(factor.status)}
                  <span className="font-medium text-sm">{factor.name}</span>
                </div>
                <span className="text-sm font-mono">{factor.score}/{factor.maxScore}</span>
              </div>
              <p className="text-xs text-muted-foreground">{factor.tip}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center">Weights configurable in Settings → Financial Rules</p>
      </CardContent>
    </Card>
  );
}
