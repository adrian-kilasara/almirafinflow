import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/format';
import { Wallet, AlertTriangle } from 'lucide-react';
import type { Budget, Transaction, Category } from '@/types/finance';
import { isWithinInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

interface BudgetListProps {
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
}

export default function BudgetList({ budgets, transactions, categories }: BudgetListProps) {
  const budgetsWithSpent = useMemo(() => {
    const now = new Date();
    
    return budgets.map(budget => {
      let startDate: Date;
      let endDate: Date;
      
      switch (budget.period) {
        case 'daily':
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case 'weekly':
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          break;
        case 'monthly':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'yearly':
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          break;
      }
      
      const relevantTransactions = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        
        const transactionDate = parseISO(t.date);
        const withinPeriod = isWithinInterval(transactionDate, { start: startDate, end: endDate });
        
        if (budget.category_id) {
          return withinPeriod && t.category_id === budget.category_id;
        }
        
        return withinPeriod;
      });
      
      const spent = relevantTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const percentage = (spent / Number(budget.amount)) * 100;
      const remaining = Number(budget.amount) - spent;
      
      return {
        ...budget,
        spent,
        percentage: Math.min(percentage, 100),
        remaining,
        isOverBudget: spent > Number(budget.amount),
        category: categories.find(c => c.id === budget.category_id),
      };
    });
  }, [budgets, transactions, categories]);

  if (budgets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No budgets set</p>
          <p className="text-sm">Create a budget to track your spending</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {budgetsWithSpent.map((budget) => (
        <Card 
          key={budget.id} 
          className={budget.isOverBudget ? 'border-destructive/50' : ''}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{budget.name}</h3>
                  {budget.isOverBudget && (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="capitalize">{budget.period}</span>
                  {budget.category && (
                    <>
                      <span>•</span>
                      <span>{budget.category.icon} {budget.category.name}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold">
                  {formatCurrency(budget.spent, budget.currency)} / {formatCurrency(Number(budget.amount), budget.currency)}
                </p>
                <p className={`text-sm ${budget.remaining >= 0 ? 'text-income' : 'text-expense'}`}>
                  {budget.remaining >= 0 
                    ? `${formatCurrency(budget.remaining, budget.currency)} left`
                    : `${formatCurrency(Math.abs(budget.remaining), budget.currency)} over`
                  }
                </p>
              </div>
            </div>
            <Progress 
              value={budget.percentage} 
              className={`h-2 ${budget.isOverBudget ? '[&>div]:bg-destructive' : ''}`}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
