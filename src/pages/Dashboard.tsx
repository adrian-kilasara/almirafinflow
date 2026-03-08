import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/format';
import { 
  Wallet, TrendingUp, TrendingDown, PiggyBank, 
  LogOut, Sparkles, Target, CreditCard, BarChart3,
  Receipt, Folder, Menu, GraduationCap, Settings, AlertTriangle,
  User, ChevronDown, X, Archive, CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { ACCOUNT_TYPE_ICONS } from '@/types/finance';
import type { Account, Transaction, Category, Budget, SavingsGoal, UserStreak, TransactionType } from '@/types/finance';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Components
import TransactionList from '@/components/transactions/TransactionList';
import TransactionForm from '@/components/transactions/TransactionForm';
import AccountForm from '@/components/accounts/AccountForm';
import AccountCard from '@/components/accounts/AccountCard';
import AccountDetailPanel from '@/components/accounts/AccountDetailPanel';
import TransferForm from '@/components/accounts/TransferForm';
import BudgetForm from '@/components/budgets/BudgetForm';
import BudgetList from '@/components/budgets/BudgetList';
import BudgetCard from '@/components/budgets/BudgetCard';
import SavingsDashboard from '@/components/savings/SavingsDashboard';
import CategoryManager from '@/components/categories/CategoryManager';
import EnhancedReports from '@/components/reports/EnhancedReports';
import FinancialHealthScore from '@/components/dashboard/FinancialHealthScore';
import UserBadges from '@/components/gamification/UserBadges';
import StreakTracker from '@/components/gamification/StreakTracker';
import FinancialLessons from '@/components/education/FinancialLessons';
import TransactionRulesManager from '@/components/rules/TransactionRulesManager';
import FloatingTransactionForm from '@/components/transactions/FloatingTransactionForm';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import NetWorthChart from '@/components/dashboard/NetWorthChart';
import AISmartInsights from '@/components/dashboard/AISmartInsights';
import BillsSubscriptions from '@/components/bills/BillsSubscriptions';
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
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab]);

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

  // Goal progress alerts
  const goalAlerts = useMemo(() => {
    if (!settings.notify_goal_progress) return [];
    return savingsGoals.filter(g => {
      const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
      return pct >= 80 && !g.is_completed;
    });
  }, [savingsGoals, settings.notify_goal_progress]);

  // Budget exceeded notification alerts
  const budgetExceededAlerts = useMemo(() => {
    if (!settings.notify_budget_exceeded) return [];
    return budgets.filter(b => {
      const spent = currentMonthTransactions
        .filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true))
        .reduce((s, t) => s + Number(t.amount), 0);
      return spent > Number(b.amount);
    });
  }, [budgets, currentMonthTransactions, settings.notify_budget_exceeded]);

  // Density classes
  const densityClasses = useMemo(() => {
    switch (settings.dashboard_density) {
      case 'compact': return { gap: 'gap-3', padding: 'p-3', cardPadding: 'p-3 sm:p-4', textSize: 'text-sm' };
      case 'detailed': return { gap: 'gap-8', padding: 'py-8', cardPadding: 'p-5 sm:p-8', textSize: 'text-base' };
      default: return { gap: 'gap-4', padding: 'py-6', cardPadding: 'p-4 sm:p-6', textSize: 'text-sm' };
    }
  }, [settings.dashboard_density]);

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
    { id: 'overview', label: 'Overview', icon: Wallet, badge: '' },
    { id: 'accounts', label: 'Accounts', icon: CreditCard, badge: accounts.length > 0 ? String(accounts.length) : '' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, badge: '' },
    { id: 'budgets', label: 'Budgets', icon: Folder, badge: overBudgetAlerts.length > 0 ? '!' : '' },
    { id: 'bills', label: 'Bills', icon: CalendarClock, badge: '' },
    { id: 'savings', label: 'Savings', icon: PiggyBank, badge: '' },
    { id: 'reports', label: 'Reports', icon: BarChart3, badge: '' },
    { id: 'learn', label: 'Learn', icon: GraduationCap, badge: '' },
  ];

  const MobileNav = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 rounded-xl">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 border-r-border/30">
        <div className="flex items-center gap-3 p-5 border-b border-border/30">
          <motion.div 
            className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center"
            whileHover={{ rotate: -5 }}
          >
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </motion.div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">FinFlow</h1>
            <p className="text-[10px] text-muted-foreground">2026 Edition</p>
          </div>
        </div>
        <nav className="p-3 space-y-0.5">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && (
                  <motion.div layoutId="mobile-active-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
                {item.badge === '!' && !isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-destructive" />
                )}
              </motion.button>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/30">
          <div className="flex items-center gap-3 mb-3 px-1">
            <Avatar className="w-8 h-8 border border-primary/20">
              {settings.avatar_url && <AvatarImage src={settings.avatar_url} alt={settings.username || 'Avatar'} />}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {(settings.username || settings.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{settings.username || settings.full_name || 'User'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs h-8" onClick={() => navigate('/settings')}>
              <Settings className="w-3.5 h-3.5 mr-1" /> Settings
            </Button>
            <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs h-8 text-destructive hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Savings rate for overview
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* ===== HEADER ===== */}
      <header className="border-b border-border/40 bg-card/70 backdrop-blur-2xl sticky top-0 z-50">
        <div className="container mx-auto px-4">
          {/* Top row */}
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <MobileNav />
              <motion.div
                className="w-9 h-9 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center"
                whileHover={{ scale: 1.08, rotate: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Wallet className="w-4.5 h-4.5 text-primary-foreground" />
              </motion.div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
                  FinFlow
                </h1>
                <p className="text-[9px] text-muted-foreground -mt-0.5">2026</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <CategoryManager onSuccess={fetchData} />
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl px-2 h-9 hover:bg-muted/60">
                    <Avatar className="w-7 h-7 border border-primary/20">
                      {settings.avatar_url && <AvatarImage src={settings.avatar_url} alt={settings.username || 'Avatar'} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                        {(settings.username || settings.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-xs font-medium max-w-[80px] truncate">{settings.username || settings.full_name || 'User'}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar className="w-9 h-9 border border-primary/20">
                      {settings.avatar_url && <AvatarImage src={settings.avatar_url} alt={settings.username || 'Avatar'} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {(settings.username || settings.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{settings.full_name || 'User'}</p>
                      {settings.username && <p className="text-[10px] text-primary truncate">@{settings.username}</p>}
                      <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 rounded-lg cursor-pointer text-xs">
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab('learn')} className="gap-2 rounded-lg cursor-pointer text-xs">
                    <GraduationCap className="w-3.5 h-3.5" /> Financial Education
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 rounded-lg cursor-pointer text-xs text-destructive focus:text-destructive">
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ===== DESKTOP TABS ===== */}
          <div className="hidden md:block relative -mb-px">
            <div className="flex items-center gap-0.5 relative" role="tablist">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => { tabRefs.current[item.id] = el; }}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors duration-200 ${
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.badge === '!' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    )}
                    {item.badge && item.badge !== '!' && (
                      <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 rounded-full">{item.badge}</span>
                    )}
                  </button>
                );
              })}
              <motion.div
                className="absolute bottom-0 h-[2px] bg-primary rounded-full"
                animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className={`container mx-auto px-4 ${densityClasses.padding}`}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-5">
            {/* Live Alerts */}
            <AnimatePresence>
              {lowBalanceAccounts.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/20">
                    <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))] shrink-0" />
                    <p className="text-xs"><span className="font-semibold">Low Balance:</span> {lowBalanceAccounts.map(a => `${a.name} (${formatCurrency(Number(a.balance), a.currency)})`).join(', ')}</p>
                  </div>
                </motion.div>
              )}
              {overBudgetAlerts.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-xs"><span className="font-semibold">Over Budget:</span> {overBudgetAlerts.map(b => b.name).join(', ')}</p>
                  </div>
                </motion.div>
              )}
              {goalAlerts.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-income/5 border border-income/20">
                    <Target className="w-4 h-4 text-income shrink-0" />
                    <p className="text-xs"><span className="font-semibold">🎉 Almost there:</span> {goalAlerts.map(g => g.name).join(', ')} — 80%+ complete</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hero Net Worth + Quick Stats */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Card className="relative overflow-hidden border-primary/10">
                {/* Ambient glows */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-income/5 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />
                
                <CardContent className="relative p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Wallet className="w-3 h-3 text-primary" />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Net Worth</p>
                      </div>
                      <motion.p
                        className="text-3xl sm:text-4xl font-bold font-mono tracking-tight"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      >
                        {formatCurrency(totalBalance)}
                      </motion.p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-income" />
                          <span className="text-[10px] text-muted-foreground">Income</span>
                          <span className="text-[11px] font-mono font-semibold text-income">{formatCurrency(totalIncome)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-expense" />
                          <span className="text-[10px] text-muted-foreground">Expenses</span>
                          <span className="text-[11px] font-mono font-semibold text-expense">{formatCurrency(totalExpenses)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick stat pills */}
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
                      {[
                        { label: 'Net Flow', value: `${netFlow >= 0 ? '+' : ''}${formatCurrency(netFlow)}`, color: netFlow >= 0 ? 'text-income' : 'text-expense' },
                        { label: 'Savings', value: formatCurrency(totalSavings), color: 'text-primary' },
                        { label: 'Save Rate', value: `${savingsRate}%`, color: savingsRate >= 20 ? 'text-income' : 'text-[hsl(var(--warning))]' },
                      ].map((stat, i) => (
                        <motion.div
                          key={stat.label}
                          whileHover={{ scale: 1.03 }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.05 }}
                          className="px-3 py-2 rounded-xl bg-muted/30 border border-border/30 text-center min-w-[85px]"
                        >
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                          <p className={`text-sm font-bold font-mono ${stat.color}`}>{stat.value}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Streak + Badges */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <StreakTracker transactions={transactions} onStreakUpdate={setCurrentStreak} />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                <UserBadges
                  transactionCount={transactions.length}
                  accountCount={accounts.length}
                  budgetCount={budgets.length}
                  savingsGoalCount={savingsGoals.length}
                  currentStreak={currentStreak?.current_streak || 0}
                  totalSaved={totalSavings}
                  healthScore={healthScore}
                />
              </motion.div>
            </div>

            {/* Bento Grid: Health + AI + Accounts + Savings */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Health Score - spans 2 rows */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="md:row-span-2"
              >
                <FinancialHealthScore accounts={accounts} transactions={transactions} budgets={budgets} savingsGoals={savingsGoals} />
              </motion.div>

              {/* AI Financial Advisor */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="lg:col-span-2"
              >
                <Card className="h-full border-primary/10 bg-gradient-to-br from-card to-primary/[0.02]">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">AI Financial Advisor</CardTitle>
                        <p className="text-[9px] text-muted-foreground">Personalized insights from your data</p>
                      </div>
                    </div>
                    <Button onClick={getFinancialTip} disabled={loadingTip} size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1.5">
                      {loadingTip ? (
                        <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full" /> Analyzing</>
                      ) : (
                        <><Sparkles className="w-3 h-3" /> Get Insights</>
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <AnimatePresence mode="wait">
                      {aiTip ? (
                        <motion.div key="tip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed"
                        >{aiTip}</motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 py-2">
                          <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-primary/30" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Tap <span className="font-medium text-foreground">"Get Insights"</span> for AI-powered advice based on your spending patterns.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Accounts Summary */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-3 h-3 text-primary" />
                      </div>
                      Accounts
                    </CardTitle>
                    <AccountForm onSuccess={fetchData} />
                  </CardHeader>
                  <CardContent>
                    {accounts.length > 0 ? (
                      <div className="space-y-1.5">
                        {accounts.slice(0, 4).map((account, i) => (
                          <motion.div
                            key={account.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 + i * 0.04 }}
                            whileHover={{ x: 3 }}
                            className="flex items-center justify-between p-2 rounded-xl bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group border border-transparent hover:border-border/20"
                            onClick={() => { setSelectedAccount(account); setActiveTab('accounts'); }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{ACCOUNT_TYPE_ICONS[account.type] || '💰'}</span>
                              <div>
                                <p className="font-medium text-xs group-hover:text-primary transition-colors">{account.name}</p>
                                <p className="text-[9px] text-muted-foreground capitalize">{account.type.replace('_', ' ')}</p>
                              </div>
                            </div>
                            <p className="font-mono text-xs font-semibold">{formatCurrency(Number(account.balance), account.currency)}</p>
                          </motion.div>
                        ))}
                        {accounts.length > 4 && (
                          <button onClick={() => setActiveTab('accounts')} className="w-full text-[10px] text-center text-primary hover:underline pt-1">
                            View all {accounts.length} accounts →
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <CreditCard className="w-7 h-7 text-muted-foreground/20 mx-auto mb-1.5" />
                        <p className="text-muted-foreground text-xs">Add your first account</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Savings Goals */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <PiggyBank className="w-3 h-3 text-primary" />
                      </div>
                      Savings Goals
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="text-[10px] text-primary h-7 px-2" onClick={() => setActiveTab('savings')}>
                      View All
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {savingsGoals.length > 0 ? (
                      <div className="space-y-2.5">
                        {savingsGoals.slice(0, 3).map((goal, i) => {
                          const percentage = Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100);
                          return (
                            <motion.div
                              key={goal.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.4 + i * 0.04 }}
                              className="p-2 rounded-xl bg-muted/20"
                            >
                              <div className="flex justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs">{goal.icon || '🎯'}</span>
                                  <p className="font-medium text-xs">{goal.name}</p>
                                </div>
                                <span className={`text-[10px] font-mono font-bold ${percentage >= 80 ? 'text-income' : 'text-muted-foreground'}`}>{percentage}%</span>
                              </div>
                              <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  className="absolute inset-y-0 left-0 rounded-full bg-primary"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(percentage, 100)}%` }}
                                  transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: 'easeOut' }}
                                />
                              </div>
                              <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
                                <span>{formatCurrency(Number(goal.current_amount), goal.currency)}</span>
                                <span>{formatCurrency(Number(goal.target_amount), goal.currency)}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <PiggyBank className="w-7 h-7 text-muted-foreground/20 mx-auto mb-1.5" />
                        <p className="text-muted-foreground text-xs">Start saving today!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent Transactions */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <TransactionList
                transactions={transactions.slice(0, 5)}
                categories={categories}
                accounts={accounts}
                onRefresh={fetchData}
              />
            </motion.div>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <AnimatePresence mode="wait">
            {selectedAccount ? (
              <AccountDetailPanel
                account={selectedAccount}
                transactions={transactions}
                budgets={budgets}
                savingsGoals={savingsGoals}
                onBack={() => setSelectedAccount(null)}
              />
            ) : (
              <motion.div
                key="accounts-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Net Position Hero */}
                {accounts.length > 0 && (() => {
                  const activeAccts = accounts.filter(a => a.is_active && !a.is_archived);
                  const totalAssets = activeAccts
                    .filter(a => a.classification !== 'liability')
                    .reduce((s, a) => s + Number(a.balance), 0);
                  const totalLiabilities = activeAccts
                    .filter(a => a.classification === 'liability')
                    .reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
                  const netPosition = totalAssets - totalLiabilities;
                  const assetPct = totalAssets + totalLiabilities > 0 ? (totalAssets / (totalAssets + totalLiabilities)) * 100 : 100;
                  const accountCount = activeAccts.length;
                  return (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                      <Card className="relative overflow-hidden border-primary/10">
                        {/* Multi-layer ambient */}
                        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-income/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 bg-primary/3 rounded-full blur-[60px]" />
                        
                        <CardContent className="relative p-5 sm:p-6">
                          {/* Top row: Net Position + Account Count */}
                          <div className="flex items-start justify-between mb-5">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Net Position</p>
                              </div>
                              <motion.p
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 180, delay: 0.1 }}
                                className={`text-3xl sm:text-4xl font-extrabold font-mono tracking-tight ${netPosition >= 0 ? '' : 'text-expense'}`}
                              >
                                {formatCurrency(netPosition)}
                              </motion.p>
                            </div>
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.2 }}
                              className="text-right"
                            >
                              <p className="text-3xl font-extrabold font-mono text-primary/20">{accountCount}</p>
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wider -mt-0.5">Accounts</p>
                            </motion.div>
                          </div>

                          {/* Asset / Liability breakdown */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <motion.div
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 }}
                              className="p-3 rounded-xl bg-income/5 border border-income/10"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <TrendingUp className="w-3 h-3 text-income" />
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Assets</p>
                              </div>
                              <p className="text-lg font-bold font-mono text-income">{formatCurrency(totalAssets)}</p>
                            </motion.div>
                            <motion.div
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 }}
                              className="p-3 rounded-xl bg-expense/5 border border-expense/10"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <TrendingDown className="w-3 h-3 text-expense" />
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Liabilities</p>
                              </div>
                              <p className="text-lg font-bold font-mono text-expense">-{formatCurrency(totalLiabilities)}</p>
                            </motion.div>
                          </div>

                          {/* Ratio bar */}
                          <div className="space-y-1.5">
                            <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-muted/30">
                              <motion.div
                                className="bg-gradient-to-r from-income to-income/80 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${assetPct}%` }}
                                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                              />
                              {totalLiabilities > 0 && (
                                <motion.div
                                  className="bg-gradient-to-r from-expense/80 to-expense rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${100 - assetPct}%` }}
                                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                                />
                              )}
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-income" /> Assets {Math.round(assetPct)}%</span>
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-expense" /> Liabilities {Math.round(100 - assetPct)}%</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })()}

                {/* Action bar */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">Your Accounts</h2>
                      <p className="text-[10px] text-muted-foreground">{accounts.filter(a => a.is_active).length} active · {accounts.length} total</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <TransferForm accounts={accounts} onSuccess={fetchData} />
                    <AccountForm onSuccess={fetchData} />
                  </div>
                </motion.div>

                {accounts.length > 0 ? (() => {
                  const active = accounts.filter(a => a.is_active && !a.is_archived);
                  const archived = accounts.filter(a => a.is_archived);
                  const assets = active.filter(a => a.classification !== 'liability');
                  const liabilities = active.filter(a => a.classification === 'liability');

                  return (
                    <div className="space-y-8">
                      {/* Assets */}
                      {assets.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-income/10 flex items-center justify-center">
                              <TrendingUp className="w-3 h-3 text-income" />
                            </div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assets ({assets.length})</h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                            <span className="text-[10px] font-mono font-semibold text-income">
                              {formatCurrency(assets.reduce((s, a) => s + Number(a.balance), 0))}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {assets.map((account, i) => (
                              <AccountCard
                                key={account.id}
                                account={account}
                                transactions={transactions}
                                onRefresh={fetchData}
                                onSelect={setSelectedAccount}
                                index={i}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Liabilities */}
                      {liabilities.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-expense/10 flex items-center justify-center">
                              <TrendingDown className="w-3 h-3 text-expense" />
                            </div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Liabilities ({liabilities.length})</h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                            <span className="text-[10px] font-mono font-semibold text-expense">
                              -{formatCurrency(liabilities.reduce((s, a) => s + Math.abs(Number(a.balance)), 0))}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {liabilities.map((account, i) => (
                              <AccountCard
                                key={account.id}
                                account={account}
                                transactions={transactions}
                                onRefresh={fetchData}
                                onSelect={setSelectedAccount}
                                index={i}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Archived */}
                      {archived.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-muted/50 flex items-center justify-center">
                              <Archive className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Archived ({archived.length})</h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {archived.map((account, i) => (
                              <AccountCard
                                key={account.id}
                                account={account}
                                transactions={transactions}
                                onRefresh={fetchData}
                                onSelect={setSelectedAccount}
                                index={i}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })() : (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                    <Card className="border-dashed border-2">
                      <CardContent className="py-20 text-center">
                        <motion.div
                          animate={{ y: [0, -8, 0] }}
                          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/30 flex items-center justify-center"
                        >
                          <CreditCard className="w-8 h-8 text-muted-foreground/30" />
                        </motion.div>
                        <p className="font-bold text-lg">No accounts yet</p>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">Add your bank accounts, mobile money, and cash to get started</p>
                        <AccountForm onSuccess={fetchData} />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 12 }} 
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Transactions</h2>
                  <p className="text-[10px] text-muted-foreground">{transactions.length} total records</p>
                </div>
              </div>
              <div className="flex gap-2">
                <TransactionForm accounts={accounts} categories={categories} onSuccess={fetchData} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <TransactionRulesManager categories={categories} onRulesChange={fetchData} />
            </motion.div>
            <TransactionList 
              transactions={transactions} 
              categories={categories}
              accounts={accounts}
              onRefresh={fetchData}
            />
          </TabsContent>

          {/* Budgets Tab */}
          <TabsContent value="budgets" className="space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Folder className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">Budget Tracking</h2>
                  <p className="text-[10px] text-muted-foreground">{budgets.length} budgets · {budgets.filter(b => {
                    const spent = transactions.filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true)).reduce((s, t) => s + Number(t.amount), 0);
                    return spent > Number(b.amount);
                  }).length} over budget</p>
                </div>
              </div>
              <BudgetForm categories={categories} transactions={transactions} savingsGoals={savingsGoals} onSuccess={fetchData} />
            </motion.div>

            {/* Overview Dashboard */}
            <BudgetList budgets={budgets} transactions={transactions} categories={categories} />

            {/* Individual Budget Cards */}
            {budgets.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="w-3 h-3 text-primary" />
                  </div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Individual Budgets</h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {budgets.map((budget, i) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      transactions={transactions}
                      categories={categories}
                      rolloverEnabled={settings.budget_rollover}
                      onRefresh={fetchData}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </TabsContent>

          {/* Savings Tab */}
          <TabsContent value="savings" className="space-y-6">
            <SavingsDashboard
              savingsGoals={savingsGoals}
              transactions={transactions}
              accounts={accounts}
              onRefresh={fetchData}
            />
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
            <FinancialLessons
              transactions={transactions}
              categories={categories}
              budgets={budgets}
              savingsGoals={savingsGoals}
              accounts={accounts}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border">
        <div className="flex items-center justify-around py-1.5 px-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-bottom-indicator"
                    className="absolute -top-1.5 w-8 h-1 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setActiveTab(activeTab === 'reports' ? 'learn' : 'reports')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
              ['reports', 'learn'].includes(activeTab) ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Centered Floating Action Button */}
      <FloatingTransactionForm
        accounts={accounts}
        categories={categories}
        onSuccess={fetchData}
      />
    </div>
  );
}
