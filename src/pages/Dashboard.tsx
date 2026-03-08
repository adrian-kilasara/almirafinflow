import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/format';
import { 
  Wallet, TrendingUp, TrendingDown, PiggyBank, 
  LogOut, Sparkles, Target, CreditCard, BarChart3,
  Receipt, Folder, Menu, GraduationCap, Settings, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { ACCOUNT_TYPE_ICONS } from '@/types/finance';
import type { Account, Transaction, Category, Budget, SavingsGoal, UserStreak, TransactionType } from '@/types/finance';

// Components
import TransactionList from '@/components/transactions/TransactionList';
import AccountForm from '@/components/accounts/AccountForm';
import AccountCard from '@/components/accounts/AccountCard';
import BudgetForm from '@/components/budgets/BudgetForm';
import BudgetCard from '@/components/budgets/BudgetCard';
import SavingsGoalForm from '@/components/savings/SavingsGoalForm';
import SavingsGoalCard from '@/components/savings/SavingsGoalCard';
import CategoryManager from '@/components/categories/CategoryManager';
import EnhancedReports from '@/components/reports/EnhancedReports';
import FinancialHealthScore from '@/components/dashboard/FinancialHealthScore';
import UserBadges from '@/components/gamification/UserBadges';
import StreakTracker from '@/components/gamification/StreakTracker';
import FinancialLessons from '@/components/education/FinancialLessons';
import TransactionRulesManager from '@/components/rules/TransactionRulesManager';
import FloatingTransactionForm from '@/components/transactions/FloatingTransactionForm';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [aiTip, setAiTip] = useState<string>('');
  const [loadingTip, setLoadingTip] = useState(false);
  const [activeTab, setActiveTab] = useState(settings.default_landing_tab || 'overview');
  const [currentStreak, setCurrentStreak] = useState<UserStreak | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionFormType, setTransactionFormType] = useState<'income' | 'expense' | 'transfer'>('expense');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const fetchData = useCallback(async () => {
    // Fetch all data without the default 1000-row limit for transactions
    const [accountsRes, transactionsRes, categoriesRes, budgetsRes, goalsRes] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').order('date', { ascending: false }).limit(10000),
      supabase.from('categories').select('*').order('name'),
      supabase.from('budgets').select('*').order('created_at', { ascending: false }),
      supabase.from('savings_goals').select('*').order('created_at', { ascending: false }),
    ]);
    
    if (accountsRes.data) setAccounts(accountsRes.data as Account[]);
    if (transactionsRes.data) setTransactions(transactionsRes.data as Transaction[]);
    if (categoriesRes.data) setCategories(categoriesRes.data as Category[]);
    if (budgetsRes.data) setBudgets(budgetsRes.data as Budget[]);
    if (goalsRes.data) setSavingsGoals(goalsRes.data as SavingsGoal[]);
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const getFinancialTip = async () => {
    if (!settings.ai_enabled) {
      toast.info('AI insights are disabled. Enable them in Settings → AI & Insights.');
      return;
    }
    setLoadingTip(true);
    try {
      const incomeTotal = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
      const expenseTotal = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
      const savingsRate = incomeTotal > 0 ? ((incomeTotal - expenseTotal) / incomeTotal) * 100 : 0;
      
      const categorySpending: Record<string, number> = {};
      transactions.filter(t => t.type === 'expense').forEach(t => {
        const cat = categories.find(c => c.id === t.category_id);
        const catName = cat?.name || 'Uncategorized';
        categorySpending[catName] = (categorySpending[catName] || 0) + Number(t.amount);
      });
      
      const budgetPerformance = budgets.map(b => {
        const spent = transactions
          .filter(t => t.type === 'expense' && t.category_id === b.category_id)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        return { name: b.name, budgeted: Number(b.amount), spent, overBudget: spent > Number(b.amount) };
      });
      
      const goalsProgress = savingsGoals.map(g => ({
        name: g.name,
        targetAmount: Number(g.target_amount),
        currentAmount: Number(g.current_amount),
        percentage: (Number(g.current_amount) / Number(g.target_amount)) * 100,
      }));

      const { data, error } = await supabase.functions.invoke('financial-tips', {
        body: {
          financialData: {
            totalBalance: accounts.reduce((sum, a) => sum + Number(a.balance), 0),
            accountCount: accounts.length,
            transactionCount: transactions.length,
            totalIncome: incomeTotal,
            totalExpenses: expenseTotal,
            netCashFlow: incomeTotal - expenseTotal,
            savingsRate: savingsRate.toFixed(1),
            categorySpending,
            budgetPerformance,
            goalsProgress,
            currentStreak: currentStreak?.current_streak || 0,
            healthScore,
          },
          tipType: 'general',
          // Pass user AI settings for personalized advice
          aiSettings: {
            adviceMode: settings.ai_advice_mode,
            riskTolerance: settings.ai_risk_tolerance,
            currency: settings.default_currency,
          },
        },
      });
      
      if (error) throw error;
      setAiTip(data.tips);
    } catch (error: any) {
      toast.error(error.message || 'Failed to get financial tip');
    } finally {
      setLoadingTip(false);
    }
  };

  // Calculate financial metrics
  // Net Worth = sum of all account balances (reflects real-time state)
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  
  // Income, Expenses, Net Flow = current month only for meaningful overview
  const currentMonthTransactions = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return transactions.filter(t => t.date >= monthStart && t.date <= monthEnd);
  }, [transactions]);
  
  const totalIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const netFlow = totalIncome - totalExpenses;
  const totalSavings = savingsGoals.reduce((sum, g) => sum + Number(g.current_amount), 0);

  // Low balance alerts from settings
  const lowBalanceAccounts = useMemo(() => {
    if (!settings.notify_low_balance) return [];
    return accounts.filter(a => a.is_active && Number(a.balance) < settings.low_balance_threshold);
  }, [accounts, settings.notify_low_balance, settings.low_balance_threshold]);

  // Budget mode strict warnings
  const overBudgetAlerts = useMemo(() => {
    if (settings.budget_mode !== 'strict') return [];
    return budgets.filter(b => {
      const spent = currentMonthTransactions
        .filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true))
        .reduce((s, t) => s + Number(t.amount), 0);
      return spent > Number(b.amount);
    });
  }, [budgets, currentMonthTransactions, settings.budget_mode]);

  // Health score calculation (simplified for badge checking)
  const healthScore = Math.min(100, Math.round(
    (accounts.length > 0 ? 20 : 0) +
    (transactions.length >= 10 ? 20 : transactions.length * 2) +
    (budgets.length > 0 ? 20 : 0) +
    (savingsGoals.length > 0 ? 20 : 0) +
    ((totalIncome > 0 && (totalIncome - totalExpenses) / totalIncome >= 0.2) ? 20 : 10)
  ));

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center animate-pulse">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading FinFlow 2026...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Wallet },
    { id: 'accounts', label: 'Accounts', icon: CreditCard },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'budgets', label: 'Budgets', icon: Folder },
    { id: 'savings', label: 'Savings', icon: PiggyBank },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'learn', label: 'Learn', icon: GraduationCap },
  ];

  const MobileNav = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              FinFlow
            </h1>
            <p className="text-xs text-muted-foreground">2026 Edition</p>
          </div>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-6 left-6 right-6">
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MobileNav />
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                FinFlow 2026
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CategoryManager onSuccess={fetchData} />
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden md:flex" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="hidden md:flex mb-6 bg-muted/50">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger key={item.id} value={item.id} className="gap-2">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Streak Tracker */}
            <StreakTracker 
              transactions={transactions} 
              onStreakUpdate={setCurrentStreak}
            />

            {/* Main Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card variant="glow" className="animate-fadeIn">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Net Worth</p>
                      <p className="text-lg sm:text-2xl font-bold font-mono mt-1">{formatCurrency(totalBalance)}</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="income" className="animate-fadeIn" style={{ animationDelay: '0.1s' }}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Income (This Month)</p>
                      <p className="text-lg sm:text-2xl font-bold font-mono mt-1 text-income">{formatCurrency(totalIncome)}</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-income/10 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-income" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="expense" className="animate-fadeIn" style={{ animationDelay: '0.2s' }}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Expenses (This Month)</p>
                      <p className="text-lg sm:text-2xl font-bold font-mono mt-1 text-expense">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-expense/10 rounded-xl flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-expense" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fadeIn" style={{ animationDelay: '0.3s' }}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Net Flow (This Month)</p>
                      <p className={`text-lg sm:text-2xl font-bold font-mono mt-1 ${netFlow >= 0 ? 'text-income' : 'text-expense'}`}>
                        {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
                      </p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                      <Target className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Badges */}
            <UserBadges
              transactionCount={transactions.length}
              accountCount={accounts.length}
              budgetCount={budgets.length}
              savingsGoalCount={savingsGoals.length}
              currentStreak={currentStreak?.current_streak || 0}
              totalSaved={totalSavings}
              healthScore={healthScore}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Health Score */}
              <div className="lg:col-span-1">
                <FinancialHealthScore
                  accounts={accounts}
                  transactions={transactions}
                  budgets={budgets}
                  savingsGoals={savingsGoals}
                />
              </div>

              {/* AI Tips & Accounts */}
              <div className="lg:col-span-2 space-y-6">
                {/* AI Financial Tips */}
                <Card variant="glass">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <CardTitle className="text-base">AI Financial Advisor</CardTitle>
                    </div>
                    <Button onClick={getFinancialTip} disabled={loadingTip} size="sm" variant="outline">
                      {loadingTip ? 'Analyzing...' : 'Get Tips'}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {aiTip ? (
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {aiTip}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Click "Get Tips" to receive personalized 2026 financial advice based on your spending patterns.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Accounts & Savings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Accounts */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CreditCard className="w-4 h-4" />
                        Accounts
                      </CardTitle>
                      <AccountForm onSuccess={fetchData} />
                    </CardHeader>
                    <CardContent>
                      {accounts.length > 0 ? (
                        <div className="space-y-2">
                          {accounts.slice(0, 4).map((account) => (
                            <div key={account.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{ACCOUNT_TYPE_ICONS[account.type] || '💰'}</span>
                                <div>
                                  <p className="font-medium text-sm">{account.name}</p>
                                  <p className="text-[10px] text-muted-foreground capitalize">{account.type.replace('_', ' ')}</p>
                                </div>
                              </div>
                              <p className="font-mono text-sm font-semibold">{formatCurrency(Number(account.balance), account.currency)}</p>
                            </div>
                          ))}
                          {accounts.length > 4 && (
                            <p className="text-xs text-center text-muted-foreground pt-2">
                              +{accounts.length - 4} more accounts
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-6 text-sm">Add your first account!</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Savings Goals */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <PiggyBank className="w-4 h-4" />
                        Savings Goals
                      </CardTitle>
                      <SavingsGoalForm onSuccess={fetchData} />
                    </CardHeader>
                    <CardContent>
                      {savingsGoals.length > 0 ? (
                        <div className="space-y-3">
                          {savingsGoals.slice(0, 3).map((goal) => {
                            const percentage = Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100);
                            return (
                              <div key={goal.id} className="p-2 rounded-lg bg-muted/30">
                                <div className="flex justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{goal.icon || '🎯'}</span>
                                    <p className="font-medium text-sm">{goal.name}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{percentage}%</p>
                                </div>
                                <Progress value={percentage} className="h-1.5 mb-1" />
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span>{formatCurrency(Number(goal.current_amount), goal.currency)}</span>
                                  <span>{formatCurrency(Number(goal.target_amount), goal.currency)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-6 text-sm">Start saving today!</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <TransactionList 
              transactions={transactions.slice(0, 5)} 
              categories={categories}
              accounts={accounts}
              onRefresh={fetchData}
            />
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Your Accounts
              </h2>
              <AccountForm onSuccess={fetchData} />
            </div>
            {accounts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((account) => (
                  <AccountCard key={account.id} account={account} onRefresh={fetchData} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No accounts yet</p>
                  <p className="text-sm">Add your bank accounts, mobile money, and cash</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <TransactionRulesManager categories={categories} onRulesChange={fetchData} />
            <TransactionList 
              transactions={transactions} 
              categories={categories}
              accounts={accounts}
              onRefresh={fetchData}
            />
          </TabsContent>

          {/* Budgets Tab */}
          <TabsContent value="budgets" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Folder className="w-5 h-5" />
                Budget Tracking
              </h2>
              <BudgetForm categories={categories} onSuccess={fetchData} />
            </div>
            {budgets.length > 0 ? (
              <div className="space-y-4">
                {budgets.map((budget) => (
                  <BudgetCard 
                    key={budget.id} 
                    budget={budget} 
                    transactions={transactions}
                    categories={categories}
                    onRefresh={fetchData} 
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No budgets set</p>
                  <p className="text-sm">Create a budget to track your spending</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Savings Tab */}
          <TabsContent value="savings" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <PiggyBank className="w-5 h-5" />
                Savings Goals
              </h2>
              <SavingsGoalForm onSuccess={fetchData} />
            </div>
            {savingsGoals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savingsGoals.map((goal) => (
                  <SavingsGoalCard key={goal.id} goal={goal} onRefresh={fetchData} />
                ))}
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
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <EnhancedReports 
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              budgets={budgets}
              savingsGoals={savingsGoals}
            />
          </TabsContent>

          {/* Learn Tab */}
          <TabsContent value="learn" className="space-y-6">
            <FinancialLessons />
          </TabsContent>
        </Tabs>
      </main>

      {/* Centered Floating Action Button */}
      <FloatingTransactionForm
        accounts={accounts}
        categories={categories}
        onSuccess={fetchData}
      />
    </div>
  );
}
