import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { 
  Wallet, TrendingUp, TrendingDown, PiggyBank, 
  Plus, LogOut, Sparkles, Target, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [aiTip, setAiTip] = useState<string>('');
  const [loadingTip, setLoadingTip] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    const [accountsRes, transactionsRes, goalsRes] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').order('date', { ascending: false }).limit(10),
      supabase.from('savings_goals').select('*').order('created_at', { ascending: false }),
    ]);
    
    if (accountsRes.data) setAccounts(accountsRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (goalsRes.data) setSavingsGoals(goalsRes.data);
  };

  const getFinancialTip = async () => {
    setLoadingTip(true);
    try {
      const { data, error } = await supabase.functions.invoke('financial-tips', {
        body: {
          financialData: {
            totalBalance: accounts.reduce((sum, a) => sum + Number(a.balance), 0),
            accountCount: accounts.length,
            recentTransactions: transactions.length,
          },
          tipType: 'general',
        },
      });
      
      if (error) throw error;
      setAiTip(data.tips);
    } catch (error: any) {
      toast.error('Failed to get financial tip');
    } finally {
      setLoadingTip(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">FinanceFlow</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="glow" className="animate-fadeIn">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Balance</p>
                  <p className="text-2xl font-bold font-mono mt-1">{formatCurrency(totalBalance)}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="income" className="animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Income</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-income">{formatCurrency(totalIncome)}</p>
                </div>
                <div className="w-12 h-12 bg-income/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-income" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="expense" className="animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-expense">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="w-12 h-12 bg-expense/10 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-expense" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Savings Goals</p>
                  <p className="text-2xl font-bold font-mono mt-1">{savingsGoals.length}</p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Financial Tips */}
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle>AI Financial Advisor</CardTitle>
            </div>
            <Button onClick={getFinancialTip} disabled={loadingTip} size="sm">
              {loadingTip ? 'Thinking...' : 'Get Tips'}
            </Button>
          </CardHeader>
          <CardContent>
            {aiTip ? (
              <div className="prose prose-invert max-w-none text-sm text-muted-foreground whitespace-pre-wrap">
                {aiTip}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Click "Get Tips" to receive personalized 2026 financial advice based on your data.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accounts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Accounts
              </CardTitle>
              <Button size="sm" onClick={() => toast.info('Add account feature coming soon!')}>
                <Plus className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {accounts.length > 0 ? (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{account.type === 'mobile_money' ? '📱' : '🏦'}</span>
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                        </div>
                      </div>
                      <p className="font-mono font-semibold">{formatCurrency(Number(account.balance), account.currency)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No accounts yet. Add your first account!</p>
              )}
            </CardContent>
          </Card>

          {/* Savings Goals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5" />
                Savings Goals
              </CardTitle>
              <Button size="sm" onClick={() => toast.info('Add goal feature coming soon!')}>
                <Plus className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {savingsGoals.length > 0 ? (
                <div className="space-y-3">
                  {savingsGoals.map((goal) => (
                    <div key={goal.id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex justify-between mb-2">
                        <p className="font-medium">{goal.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100)}%
                        </p>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No savings goals yet. Start saving!</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
