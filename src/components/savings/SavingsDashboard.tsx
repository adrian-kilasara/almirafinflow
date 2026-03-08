import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  PiggyBank, Target, TrendingUp, Trophy, Clock, Download,
} from 'lucide-react';
import type { SavingsGoal, Transaction, Account } from '@/types/finance';
import SavingsGoalForm from './SavingsGoalForm';
import SavingsGoalCard from './SavingsGoalCard';

interface SavingsDashboardProps {
  savingsGoals: SavingsGoal[];
  transactions: Transaction[];
  accounts: Account[];
  onRefresh: () => void;
}

export default function SavingsDashboard({ savingsGoals, transactions, accounts, onRefresh }: SavingsDashboardProps) {
  const stats = useMemo(() => {
    const totalTarget = savingsGoals.reduce((s, g) => s + Number(g.target_amount), 0);
    const totalSaved = savingsGoals.reduce((s, g) => s + Number(g.current_amount), 0);
    const completed = savingsGoals.filter(g => g.is_completed).length;
    const active = savingsGoals.filter(g => !g.is_completed);
    const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    // Upcoming deadlines
    const upcoming = active
      .filter(g => g.target_date)
      .sort((a, b) => new Date(a.target_date!).getTime() - new Date(b.target_date!).getTime())
      .slice(0, 3);

    // Monthly savings trend (last 6 months from transactions)
    const now = new Date();
    const monthlySaved: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = d.toISOString().split('T')[0];
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const income = transactions.filter(t => t.type === 'income' && t.date >= monthStart && t.date <= monthEnd).reduce((s, t) => s + Number(t.amount), 0);
      const expenses = transactions.filter(t => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd).reduce((s, t) => s + Number(t.amount), 0);
      monthlySaved.push({
        month: d.toLocaleDateString('en', { month: 'short' }),
        amount: Math.max(income - expenses, 0),
      });
    }

    return { totalTarget, totalSaved, completed, active, overallPct, upcoming, monthlySaved, total: savingsGoals.length };
  }, [savingsGoals, transactions]);

  const exportCSV = () => {
    const header = 'Goal,Target,Saved,Progress,Status,Target Date\n';
    const rows = savingsGoals.map(g => {
      const pct = Number(g.target_amount) > 0 ? ((Number(g.current_amount) / Number(g.target_amount)) * 100).toFixed(1) : '0';
      return `"${g.name}",${g.target_amount},${g.current_amount},${pct}%,${g.is_completed ? 'Completed' : 'Active'},${g.target_date || 'N/A'}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'savings_goals.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PiggyBank className="w-5 h-5" /> Savings Goals
        </h2>
        <div className="flex gap-2">
          {savingsGoals.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
          )}
          <SavingsGoalForm onSuccess={onRefresh} transactions={transactions} />
        </div>
      </div>

      {/* Summary Cards */}
      {savingsGoals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Total Target</p>
              <p className="text-lg font-bold font-mono">{formatCurrency(stats.totalTarget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <PiggyBank className="w-5 h-5 mx-auto mb-1 text-[hsl(var(--income))]" />
              <p className="text-xs text-muted-foreground">Total Saved</p>
              <p className="text-lg font-bold font-mono text-[hsl(var(--income))]">{formatCurrency(stats.totalSaved)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-[hsl(var(--warning))]" />
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-lg font-bold">{stats.completed}/{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Overall Progress</p>
              <p className="text-lg font-bold">{stats.overallPct.toFixed(0)}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overall progress bar */}
      {savingsGoals.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Overall Savings Progress</span>
              <span className="font-mono text-muted-foreground">{formatCurrency(stats.totalSaved)} / {formatCurrency(stats.totalTarget)}</span>
            </div>
            <Progress value={stats.overallPct} />
          </CardContent>
        </Card>
      )}

      {/* Monthly Savings Trend */}
      {savingsGoals.length > 0 && stats.monthlySaved.some(m => m.amount > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Monthly Savings Capacity (6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {stats.monthlySaved.map((m, i) => {
                const max = Math.max(...stats.monthlySaved.map(x => x.amount), 1);
                const h = (m.amount / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-primary/20 rounded-t-sm relative" style={{ height: `${Math.max(h, 4)}%` }}>
                      <div className="absolute inset-0 bg-primary rounded-t-sm" style={{ height: '100%' }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Deadlines */}
      {stats.upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[hsl(var(--warning))]" /> Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.upcoming.map(g => {
              const days = Math.ceil((new Date(g.target_date!).getTime() - Date.now()) / 86400000);
              const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
              return (
                <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{g.icon || '🎯'}</span>
                    <div>
                      <p className="text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{days > 0 ? `${days} days left` : 'Past due'}</p>
                    </div>
                  </div>
                  <span className="text-sm font-mono">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Goal Cards */}
      {savingsGoals.length > 0 ? (
        <div className="space-y-4">
          {/* Active Goals */}
          {stats.active.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Active Goals ({stats.active.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.active.map((goal) => (
                  <SavingsGoalCard key={goal.id} goal={goal} onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Goals */}
          {stats.completed > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[hsl(var(--income))]" /> Completed ({stats.completed})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savingsGoals.filter(g => g.is_completed).map((goal) => (
                  <SavingsGoalCard key={goal.id} goal={goal} onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <PiggyBank className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No savings goals yet</p>
            <p className="text-sm">Start saving for your dreams</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
