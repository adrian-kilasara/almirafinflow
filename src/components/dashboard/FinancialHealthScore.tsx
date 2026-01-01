import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Heart, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
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
  accounts,
  transactions,
  budgets,
  savingsGoals,
}: FinancialHealthScoreProps) {
  const healthAnalysis = useMemo(() => {
    const factors: HealthFactor[] = [];
    
    // Factor 1: Savings Rate (0-25 points)
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    let savingsScore = 0;
    let savingsStatus: 'good' | 'warning' | 'poor' = 'poor';
    let savingsTip = '';
    
    if (savingsRate >= 20) {
      savingsScore = 25;
      savingsStatus = 'good';
      savingsTip = 'Excellent! You are saving more than 20% of your income.';
    } else if (savingsRate >= 10) {
      savingsScore = 15;
      savingsStatus = 'warning';
      savingsTip = 'Good progress! Try to increase savings to 20% for optimal financial health.';
    } else if (savingsRate > 0) {
      savingsScore = 8;
      savingsStatus = 'warning';
      savingsTip = 'You are saving, but aim for at least 10-20% of income.';
    } else {
      savingsScore = 0;
      savingsStatus = 'poor';
      savingsTip = 'You are spending more than you earn. Review your expenses immediately.';
    }
    
    factors.push({
      name: 'Savings Rate',
      score: savingsScore,
      maxScore: 25,
      status: savingsStatus,
      tip: savingsTip,
    });
    
    // Factor 2: Budget Adherence (0-25 points)
    const activeBudgets = budgets.filter(b => {
      const now = new Date();
      const start = new Date(b.start_date);
      const end = b.end_date ? new Date(b.end_date) : null;
      return start <= now && (!end || end >= now);
    });
    
    let budgetScore = 0;
    let budgetStatus: 'good' | 'warning' | 'poor' = 'poor';
    let budgetTip = '';
    
    if (activeBudgets.length === 0) {
      budgetScore = 5;
      budgetStatus = 'warning';
      budgetTip = 'Set up budgets to track and control your spending.';
    } else {
      // Calculate how many budgets are within limit
      const budgetsWithSpending = activeBudgets.map(budget => {
        const spent = transactions
          .filter(t => t.type === 'expense' && t.category_id === budget.category_id)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        return { ...budget, spent, overBudget: spent > Number(budget.amount) };
      });
      
      const overBudgetCount = budgetsWithSpending.filter(b => b.overBudget).length;
      const adherenceRate = (activeBudgets.length - overBudgetCount) / activeBudgets.length;
      
      if (adherenceRate >= 0.9) {
        budgetScore = 25;
        budgetStatus = 'good';
        budgetTip = 'Great job staying within your budgets!';
      } else if (adherenceRate >= 0.7) {
        budgetScore = 18;
        budgetStatus = 'warning';
        budgetTip = 'Most budgets are on track. Review the ones that are over.';
      } else {
        budgetScore = 8;
        budgetStatus = 'poor';
        budgetTip = 'Multiple budgets exceeded. Consider adjusting limits or cutting expenses.';
      }
    }
    
    factors.push({
      name: 'Budget Discipline',
      score: budgetScore,
      maxScore: 25,
      status: budgetStatus,
      tip: budgetTip,
    });
    
    // Factor 3: Account Diversification (0-20 points)
    const activeAccounts = accounts.filter(a => a.is_active);
    let diversificationScore = 0;
    let diversificationStatus: 'good' | 'warning' | 'poor' = 'poor';
    let diversificationTip = '';
    
    const accountTypes = new Set(activeAccounts.map(a => a.type));
    
    if (accountTypes.size >= 3) {
      diversificationScore = 20;
      diversificationStatus = 'good';
      diversificationTip = 'Well-diversified accounts across different types.';
    } else if (accountTypes.size >= 2) {
      diversificationScore = 12;
      diversificationStatus = 'warning';
      diversificationTip = 'Consider adding different account types for better money management.';
    } else if (activeAccounts.length > 0) {
      diversificationScore = 5;
      diversificationStatus = 'warning';
      diversificationTip = 'Add more account types (savings, investment) for better financial structure.';
    } else {
      diversificationScore = 0;
      diversificationStatus = 'poor';
      diversificationTip = 'Add your accounts to start tracking your finances.';
    }
    
    factors.push({
      name: 'Account Setup',
      score: diversificationScore,
      maxScore: 20,
      status: diversificationStatus,
      tip: diversificationTip,
    });
    
    // Factor 4: Savings Goals Progress (0-20 points)
    let goalsScore = 0;
    let goalsStatus: 'good' | 'warning' | 'poor' = 'poor';
    let goalsTip = '';
    
    if (savingsGoals.length === 0) {
      goalsScore = 5;
      goalsStatus = 'warning';
      goalsTip = 'Set savings goals to stay motivated and track progress.';
    } else {
      const avgProgress = savingsGoals.reduce((sum, g) => {
        return sum + (Number(g.current_amount) / Number(g.target_amount)) * 100;
      }, 0) / savingsGoals.length;
      
      if (avgProgress >= 50) {
        goalsScore = 20;
        goalsStatus = 'good';
        goalsTip = 'Excellent progress on your savings goals!';
      } else if (avgProgress >= 25) {
        goalsScore = 12;
        goalsStatus = 'warning';
        goalsTip = 'Making progress! Keep contributing to reach your goals faster.';
      } else {
        goalsScore = 6;
        goalsStatus = 'warning';
        goalsTip = 'Goals are set but need more contributions. Try automating savings.';
      }
    }
    
    factors.push({
      name: 'Goals Progress',
      score: goalsScore,
      maxScore: 20,
      status: goalsStatus,
      tip: goalsTip,
    });
    
    // Factor 5: Tracking Consistency (0-10 points)
    let trackingScore = 0;
    let trackingStatus: 'good' | 'warning' | 'poor' = 'poor';
    let trackingTip = '';
    
    const last30Days = transactions.filter(t => {
      const date = new Date(t.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= thirtyDaysAgo;
    });
    
    if (last30Days.length >= 20) {
      trackingScore = 10;
      trackingStatus = 'good';
      trackingTip = 'Great tracking consistency! Keep it up.';
    } else if (last30Days.length >= 10) {
      trackingScore = 6;
      trackingStatus = 'warning';
      trackingTip = 'Good tracking. Try to log every transaction for better insights.';
    } else if (last30Days.length > 0) {
      trackingScore = 3;
      trackingStatus = 'warning';
      trackingTip = 'Log more transactions to get accurate financial insights.';
    } else {
      trackingScore = 0;
      trackingStatus = 'poor';
      trackingTip = 'Start logging transactions to understand your spending.';
    }
    
    factors.push({
      name: 'Tracking Consistency',
      score: trackingScore,
      maxScore: 10,
      status: trackingStatus,
      tip: trackingTip,
    });
    
    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxPossibleScore = factors.reduce((sum, f) => sum + f.maxScore, 0);
    
    return { factors, totalScore, maxPossibleScore };
  }, [accounts, transactions, budgets, savingsGoals]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-income';
    if (score >= 50) return 'text-warning';
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
    switch (status) {
      case 'good':
        return <CheckCircle className="w-4 h-4 text-income" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'poor':
        return <TrendingDown className="w-4 h-4 text-expense" />;
    }
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
        {/* Main Score */}
        <div className="text-center">
          <div className={`text-5xl font-bold ${getScoreColor(healthAnalysis.totalScore)}`}>
            {healthAnalysis.totalScore}
          </div>
          <p className="text-muted-foreground">out of {healthAnalysis.maxPossibleScore}</p>
          <p className={`text-lg font-semibold mt-2 ${getScoreColor(healthAnalysis.totalScore)}`}>
            {getScoreLabel(healthAnalysis.totalScore)}
          </p>
          <Progress 
            value={(healthAnalysis.totalScore / healthAnalysis.maxPossibleScore) * 100} 
            className="mt-4 h-3"
          />
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          {healthAnalysis.factors.map((factor, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(factor.status)}
                  <span className="font-medium text-sm">{factor.name}</span>
                </div>
                <span className="text-sm font-mono">
                  {factor.score}/{factor.maxScore}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{factor.tip}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
