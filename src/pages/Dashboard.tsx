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
  User, ChevronDown, X, Archive, CalendarClock, Briefcase, ScrollText,
  ArrowUpRight, ArrowDownRight, Activity, Zap
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
import InvestmentTracker from '@/components/investments/InvestmentTracker';
import FinancialCalendar from '@/components/calendar/FinancialCalendar';
import SpendingHeatmap from '@/components/dashboard/SpendingHeatmap';
import PredictiveCashFlow from '@/components/dashboard/PredictiveCashFlow';
import SmartSpendingDetection from '@/components/dashboard/SmartSpendingDetection';
import ActivityLog from '@/components/activity/ActivityLog';
import CalendarSummary from '@/components/dashboard/CalendarSummary';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';

// Shared animation variants
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const fadeX = (x: number, delay = 0) => ({
  initial: { opacity: 0, x },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

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
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  
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

  const lowBalanceAccounts = useMemo(() => {
    if (!settings.notify_low_balance) return [];
    return accounts.filter(a => a.is_active && Number(a.balance) < settings.low_balance_threshold);
  }, [accounts, settings.notify_low_balance, settings.low_balance_threshold]);

  const overBudgetAlerts = useMemo(() => {
    if (settings.budget_mode !== 'strict') return [];
    return budgets.filter(b => {
      const spent = currentMonthTransactions
        .filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true))
        .reduce((s, t) => s + Number(t.amount), 0);
      return spent > Number(b.amount);
    });
  }, [budgets, currentMonthTransactions, settings.budget_mode]);

  const goalAlerts = useMemo(() => {
    if (!settings.notify_goal_progress) return [];
    return savingsGoals.filter(g => {
      const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
      return pct >= 80 && !g.is_completed;
    });
  }, [savingsGoals, settings.notify_goal_progress]);

  const budgetExceededAlerts = useMemo(() => {
    if (!settings.notify_budget_exceeded) return [];
    return budgets.filter(b => {
      const spent = currentMonthTransactions
        .filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true))
        .reduce((s, t) => s + Number(t.amount), 0);
      return spent > Number(b.amount);
    });
  }, [budgets, currentMonthTransactions, settings.notify_budget_exceeded]);

  const densityClasses = useMemo(() => {
    switch (settings.dashboard_density) {
      case 'compact': return { gap: 'gap-3', padding: 'p-3', cardPadding: 'p-3 sm:p-4', textSize: 'text-sm' };
      case 'detailed': return { gap: 'gap-8', padding: 'py-8', cardPadding: 'p-5 sm:p-8', textSize: 'text-base' };
      default: return { gap: 'gap-4', padding: 'py-6', cardPadding: 'p-4 sm:p-6', textSize: 'text-sm' };
    }
  }, [settings.dashboard_density]);

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
    { id: 'overview', label: 'Overview', shortLabel: 'Home', icon: Wallet, badge: '' },
    { id: 'accounts', label: 'Accounts', shortLabel: 'Accounts', icon: CreditCard, badge: accounts.length > 0 ? String(accounts.length) : '' },
    { id: 'transactions', label: 'Transactions', shortLabel: 'Txns', icon: Receipt, badge: '' },
    { id: 'budgets', label: 'Budgets', shortLabel: 'Budget', icon: Folder, badge: overBudgetAlerts.length > 0 ? '!' : '' },
    { id: 'bills', label: 'Bills', shortLabel: 'Bills', icon: CalendarClock, badge: '' },
    { id: 'investments', label: 'Investments', shortLabel: 'Invest', icon: Briefcase, badge: '' },
    { id: 'savings', label: 'Savings', shortLabel: 'Save', icon: PiggyBank, badge: '' },
    { id: 'reports', label: 'Reports', shortLabel: 'Reports', icon: BarChart3, badge: '' },
    { id: 'learn', label: 'Learn', shortLabel: 'Learn', icon: GraduationCap, badge: '' },
    { id: 'activity', label: 'Activity', shortLabel: 'Log', icon: ScrollText, badge: '' },
  ];

  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  // --- SHARED SUB-COMPONENTS ---

  const MobileNav = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 rounded-xl">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 border-r-border/30">
        <div className="flex items-center gap-3 p-5 border-b border-border/30">
          <motion.div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center" whileHover={{ rotate: -5 }}>
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
                {isActive && <motion.div layoutId="mobile-active-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                {item.badge === '!' && !isActive && <span className="ml-auto w-2 h-2 rounded-full bg-destructive" />}
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

  return (
    <div className="min-h-screen bg-background">
      {/* ===== HEADER ===== */}
      <header className="border-b border-border/40 bg-card/70 backdrop-blur-2xl sticky top-0 z-50">
        <div className="container mx-auto px-4">
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
                <h1 className="text-base font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">FinFlow</h1>
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

          {/* Desktop / Tablet Tab Bar — always shows icons + labels, adapts spacing */}
          <div className="hidden md:block relative -mb-px">
            <nav className="flex items-center relative" role="tablist">
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
                    className={`group relative flex items-center gap-1.5 px-2 lg:px-3.5 xl:px-4 py-2.5 text-[12px] lg:text-[13px] font-medium transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden md:inline">{item.label}</span>
                    {item.badge === '!' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                    )}
                    {item.badge && item.badge !== '!' && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-px rounded-full font-semibold">{item.badge}</span>
                    )}
                  </button>
                );
              })}
              {/* Animated underline indicator */}
              <motion.div
                className="absolute bottom-0 h-[2px] rounded-full bg-primary"
                animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            </nav>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className={`container mx-auto px-4 ${densityClasses.padding} pb-24 md:pb-8`}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>

          {/* ═══════════════════════════════════════════
              OVERVIEW TAB — Compact Summary Dashboard
          ═══════════════════════════════════════════ */}
          <TabsContent value="overview">
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">

              {/* Row 0: Live Alerts */}
              <AnimatePresence>
                {lowBalanceAccounts.length > 0 && (
                  <motion.div variants={staggerItem} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/20">
                      <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))] shrink-0" />
                      <p className="text-xs"><span className="font-semibold">Low Balance:</span> {lowBalanceAccounts.map(a => `${a.name} (${formatCurrency(Number(a.balance), a.currency)})`).join(', ')}</p>
                    </div>
                  </motion.div>
                )}
                {overBudgetAlerts.length > 0 && (
                  <motion.div variants={staggerItem} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      <p className="text-xs"><span className="font-semibold">Over Budget:</span> {overBudgetAlerts.map(b => b.name).join(', ')}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Row 1: Hero — Net Worth + Monthly Pulse */}
              <motion.div variants={staggerItem}>
                <Card className="relative overflow-hidden border-primary/10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-40 h-40 bg-income/5 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl pointer-events-none" />
                  <CardContent className="relative p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Wallet className="w-3 h-3 text-primary" />
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Net Worth</p>
                        </div>
                        <motion.p
                          className="text-3xl sm:text-4xl font-bold font-mono tracking-tight"
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          {formatCurrency(totalBalance)}
                        </motion.p>
                      </div>

                      {/* Monthly pulse metrics */}
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Income', value: formatCurrency(totalIncome), color: 'text-income', icon: ArrowUpRight },
                          { label: 'Expenses', value: formatCurrency(totalExpenses), color: 'text-expense', icon: ArrowDownRight },
                          { label: 'Net Flow', value: `${netFlow >= 0 ? '+' : ''}${formatCurrency(netFlow)}`, color: netFlow >= 0 ? 'text-income' : 'text-expense', icon: Activity },
                          { label: 'Save Rate', value: `${savingsRate}%`, color: savingsRate >= 20 ? 'text-income' : 'text-[hsl(var(--warning))]', icon: Zap },
                        ].map((s, i) => (
                          <motion.div
                            key={s.label}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 + i * 0.04 }}
                            className="px-2.5 py-2 rounded-xl bg-muted/30 border border-border/20 text-center"
                          >
                            <s.icon className={`w-3 h-3 mx-auto mb-0.5 ${s.color}`} />
                            <p className="text-[9px] text-muted-foreground">{s.label}</p>
                            <p className={`text-[11px] font-bold font-mono ${s.color}`}>{s.value}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Row 2: Streak + Health Score */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <motion.div variants={staggerItem}>
                  <StreakTracker transactions={transactions} onStreakUpdate={setCurrentStreak} />
                </motion.div>
                <motion.div variants={staggerItem}>
                  <FinancialHealthScore accounts={accounts} transactions={transactions} budgets={budgets} savingsGoals={savingsGoals} />
                </motion.div>
              </div>

              {/* Row 3: Bento — Accounts + Budgets + Savings + Calendar */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Accounts Summary */}
                <motion.div variants={staggerItem}>
                  <Card className="h-full border-primary/10">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                            <CreditCard className="w-3 h-3 text-primary" />
                          </div>
                          <p className="text-xs font-semibold">Accounts</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-[10px] text-primary h-6 px-2" onClick={() => setActiveTab('accounts')}>View All</Button>
                      </div>
                      {accounts.length > 0 ? (
                        <div className="space-y-1.5">
                          {accounts.filter(a => a.is_active).slice(0, 3).map((a, i) => (
                            <motion.div
                              key={a.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 + i * 0.04 }}
                              whileHover={{ x: 2 }}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/35 transition-all cursor-pointer"
                              onClick={() => { setSelectedAccount(a); setActiveTab('accounts'); }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm">{ACCOUNT_TYPE_ICONS[a.type] || '💰'}</span>
                                <p className="font-medium text-[11px] truncate">{a.name}</p>
                              </div>
                              <p className={`text-[11px] font-mono font-semibold ${Number(a.balance) >= 0 ? 'text-income' : 'text-expense'}`}>
                                {formatCurrency(Number(a.balance), a.currency)}
                              </p>
                            </motion.div>
                          ))}
                          {accounts.filter(a => a.is_active).length > 3 && (
                            <p className="text-[9px] text-muted-foreground text-center pt-1">+{accounts.filter(a => a.is_active).length - 3} more</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <CreditCard className="w-6 h-6 mx-auto mb-1 text-muted-foreground/20" />
                          <p className="text-[10px] text-muted-foreground">No accounts yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Budgets Summary */}
                <motion.div variants={staggerItem}>
                  <Card className="h-full border-primary/10">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                            <Folder className="w-3 h-3 text-primary" />
                          </div>
                          <p className="text-xs font-semibold">Budgets</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-[10px] text-primary h-6 px-2" onClick={() => setActiveTab('budgets')}>View All</Button>
                      </div>
                      {budgets.length > 0 ? (
                        <div className="space-y-2">
                          {budgets.slice(0, 3).map((b, i) => {
                            const spent = currentMonthTransactions
                              .filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true))
                              .reduce((s, t) => s + Number(t.amount), 0);
                            const pct = Math.min(Math.round((spent / Number(b.amount)) * 100), 100);
                            const over = spent > Number(b.amount);
                            return (
                              <motion.div key={b.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04 }} className="space-y-1">
                                <div className="flex justify-between">
                                  <p className="text-[11px] font-medium truncate">{b.name}</p>
                                  <span className={`text-[10px] font-mono font-semibold ${over ? 'text-expense' : 'text-muted-foreground'}`}>{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                  <motion.div
                                    className={`h-full rounded-full ${over ? 'bg-expense' : 'bg-primary'}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
                                  />
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Folder className="w-6 h-6 mx-auto mb-1 text-muted-foreground/20" />
                          <p className="text-[10px] text-muted-foreground">No budgets set</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Savings Summary */}
                <motion.div variants={staggerItem}>
                  <Card className="h-full border-primary/10">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                            <PiggyBank className="w-3 h-3 text-primary" />
                          </div>
                          <p className="text-xs font-semibold">Savings</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-[10px] text-primary h-6 px-2" onClick={() => setActiveTab('savings')}>View All</Button>
                      </div>
                      {savingsGoals.length > 0 ? (
                        <div className="space-y-2">
                          {savingsGoals.slice(0, 3).map((g, i) => {
                            const pct = Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100);
                            return (
                              <motion.div key={g.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04 }} className="space-y-1">
                                <div className="flex justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px]">{g.icon || '🎯'}</span>
                                    <p className="text-[11px] font-medium truncate">{g.name}</p>
                                  </div>
                                  <span className={`text-[10px] font-mono font-semibold ${pct >= 80 ? 'text-income' : 'text-muted-foreground'}`}>{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                  <motion.div
                                    className="h-full rounded-full bg-primary"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(pct, 100)}%` }}
                                    transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
                                  />
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <PiggyBank className="w-6 h-6 mx-auto mb-1 text-muted-foreground/20" />
                          <p className="text-[10px] text-muted-foreground">No goals yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Calendar Summary */}
                <motion.div variants={staggerItem}>
                  <CalendarSummary
                    transactions={transactions}
                    budgets={budgets}
                    savingsGoals={savingsGoals}
                    onNavigate={() => setActiveTab('activity')}
                  />
                </motion.div>
              </div>

              {/* Row 4: Net Worth Chart (full width) */}
              <motion.div variants={staggerItem}>
                <NetWorthChart accounts={accounts} transactions={transactions} />
              </motion.div>

              {/* Row 5: AI Advisor + Badges */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <motion.div variants={staggerItem}>
                  <Card className="h-full border-primary/10 bg-gradient-to-br from-card to-primary/[0.02]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold">AI Advisor</p>
                            <p className="text-[9px] text-muted-foreground">Personalized insights</p>
                          </div>
                        </div>
                        <Button onClick={getFinancialTip} disabled={loadingTip} size="sm" variant="outline" className="rounded-xl h-7 text-[10px] gap-1">
                          {loadingTip ? (
                            <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full" /> Analyzing</>
                          ) : (
                            <><Sparkles className="w-3 h-3" /> Get Insights</>
                          )}
                        </Button>
                      </div>
                      <AnimatePresence mode="wait">
                        {aiTip ? (
                          <motion.p key="tip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                            className="text-xs text-muted-foreground leading-relaxed line-clamp-4"
                          >{aiTip}</motion.p>
                        ) : (
                          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5 py-1">
                            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                              <Sparkles className="w-3.5 h-3.5 text-primary/30" />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Tap <span className="font-medium text-foreground">"Get Insights"</span> for AI-powered advice.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div variants={staggerItem}>
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

              {/* Row 6: AI Insights + Smart Detection (compact) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <motion.div variants={staggerItem}>
                  <AISmartInsights accounts={accounts} transactions={transactions} categories={categories} budgets={budgets} savingsGoals={savingsGoals} />
                </motion.div>
                <motion.div variants={staggerItem}>
                  <SmartSpendingDetection transactions={transactions} categories={categories} budgets={budgets} />
                </motion.div>
              </div>

              {/* Row 7: Predictive + Heatmap */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <motion.div variants={staggerItem}>
                  <PredictiveCashFlow accounts={accounts} transactions={transactions} />
                </motion.div>
                <motion.div variants={staggerItem}>
                  <SpendingHeatmap transactions={transactions} />
                </motion.div>
              </div>

              {/* Row 8: Recent Transactions */}
              <motion.div variants={staggerItem}>
                <Card className="border-primary/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                          <Receipt className="w-3 h-3 text-primary" />
                        </div>
                        <p className="text-xs font-semibold">Recent Transactions</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] text-primary h-6 px-2" onClick={() => setActiveTab('transactions')}>View All</Button>
                    </div>
                    <TransactionList
                      transactions={transactions.slice(0, 5)}
                      categories={categories}
                      accounts={accounts}
                      onRefresh={fetchData}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ═══ ACCOUNTS TAB ═══ */}
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
              <motion.div key="accounts-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                {/* Net Position Hero */}
                {accounts.length > 0 && (() => {
                  const activeAccts = accounts.filter(a => a.is_active && !a.is_archived);
                  const totalAssets = activeAccts.filter(a => a.classification !== 'liability').reduce((s, a) => s + Number(a.balance), 0);
                  const totalLiabilities = activeAccts.filter(a => a.classification === 'liability').reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
                  const netPosition = totalAssets - totalLiabilities;
                  const assetPct = totalAssets + totalLiabilities > 0 ? (totalAssets / (totalAssets + totalLiabilities)) * 100 : 100;
                  const accountCount = activeAccts.length;
                  return (
                    <motion.div {...fadeUp()}>
                      <Card className="relative overflow-hidden border-primary/10">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-income/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
                        <CardContent className="relative p-5 sm:p-6">
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
                            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="text-right">
                              <p className="text-3xl font-extrabold font-mono text-primary/20">{accountCount}</p>
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wider -mt-0.5">Accounts</p>
                            </motion.div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <motion.div {...fadeX(-12, 0.15)} className="p-3 rounded-xl bg-income/5 border border-income/10">
                              <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3 h-3 text-income" /><p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Assets</p></div>
                              <p className="text-lg font-bold font-mono text-income">{formatCurrency(totalAssets)}</p>
                            </motion.div>
                            <motion.div {...fadeX(12, 0.2)} className="p-3 rounded-xl bg-expense/5 border border-expense/10">
                              <div className="flex items-center gap-1.5 mb-1"><TrendingDown className="w-3 h-3 text-expense" /><p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Liabilities</p></div>
                              <p className="text-lg font-bold font-mono text-expense">-{formatCurrency(totalLiabilities)}</p>
                            </motion.div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-muted/30">
                              <motion.div className="bg-gradient-to-r from-income to-income/80 rounded-full" initial={{ width: 0 }} animate={{ width: `${assetPct}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }} />
                              {totalLiabilities > 0 && <motion.div className="bg-gradient-to-r from-expense/80 to-expense rounded-full" initial={{ width: 0 }} animate={{ width: `${100 - assetPct}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }} />}
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

                <motion.div {...fadeUp(0.15)} className="flex items-center justify-between">
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
                      {assets.length > 0 && (
                        <motion.div {...fadeUp(0.2)} className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-income/10 flex items-center justify-center"><TrendingUp className="w-3 h-3 text-income" /></div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assets ({assets.length})</h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                            <span className="text-[10px] font-mono font-semibold text-income">{formatCurrency(assets.reduce((s, a) => s + Number(a.balance), 0))}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {assets.map((account, i) => <AccountCard key={account.id} account={account} transactions={transactions} onRefresh={fetchData} onSelect={setSelectedAccount} index={i} />)}
                          </div>
                        </motion.div>
                      )}
                      {liabilities.length > 0 && (
                        <motion.div {...fadeUp(0.3)} className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-expense/10 flex items-center justify-center"><TrendingDown className="w-3 h-3 text-expense" /></div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Liabilities ({liabilities.length})</h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                            <span className="text-[10px] font-mono font-semibold text-expense">-{formatCurrency(liabilities.reduce((s, a) => s + Math.abs(Number(a.balance)), 0))}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {liabilities.map((account, i) => <AccountCard key={account.id} account={account} transactions={transactions} onRefresh={fetchData} onSelect={setSelectedAccount} index={i} />)}
                          </div>
                        </motion.div>
                      )}
                      {archived.length > 0 && (
                        <motion.div {...fadeUp(0.4)} className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-muted/50 flex items-center justify-center"><Archive className="w-3 h-3 text-muted-foreground" /></div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Archived ({archived.length})</h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {archived.map((account, i) => <AccountCard key={account.id} account={account} transactions={transactions} onRefresh={fetchData} onSelect={setSelectedAccount} index={i} />)}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })() : (
                  <motion.div {...fadeUp(0.2)}>
                    <Card className="border-dashed border-2">
                      <CardContent className="py-20 text-center">
                        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }} className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/30 flex items-center justify-center">
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

          {/* ═══ TRANSACTIONS TAB ═══ */}
          <TabsContent value="transactions" className="space-y-6">
            <motion.div {...fadeUp()} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center"><Receipt className="w-4 h-4 text-primary" /></div>
                <div>
                  <h2 className="text-lg font-bold">Transactions</h2>
                  <p className="text-[10px] text-muted-foreground">{transactions.length} total records</p>
                </div>
              </div>
              <TransactionForm accounts={accounts} categories={categories} onSuccess={fetchData} />
            </motion.div>
            <motion.div {...fadeUp(0.05)}>
              <TransactionRulesManager categories={categories} onRulesChange={fetchData} />
            </motion.div>
            <TransactionList transactions={transactions} categories={categories} accounts={accounts} onRefresh={fetchData} />
          </TabsContent>

          {/* ═══ BUDGETS TAB ═══ */}
          <TabsContent value="budgets" className="space-y-6">
            <motion.div {...fadeUp()} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><Folder className="w-4 h-4 text-primary" /></div>
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
            <BudgetList budgets={budgets} transactions={transactions} categories={categories} />
            {budgets.length > 0 && (
              <motion.div {...fadeUp(0.4)} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center"><Target className="w-3 h-3 text-primary" /></div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Individual Budgets</h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {budgets.map((budget, i) => (
                    <BudgetCard key={budget.id} budget={budget} transactions={transactions} categories={categories} rolloverEnabled={settings.budget_rollover} onRefresh={fetchData} index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </TabsContent>

          {/* ═══ BILLS TAB ═══ */}
          <TabsContent value="bills" className="space-y-6">
            <motion.div {...fadeUp()} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><CalendarClock className="w-4 h-4 text-primary" /></div>
              <div>
                <h2 className="text-lg font-extrabold">Bills & Subscriptions</h2>
                <p className="text-[10px] text-muted-foreground">Track recurring payments and due dates</p>
              </div>
            </motion.div>
            <BillsSubscriptions />
          </TabsContent>

          {/* ═══ INVESTMENTS TAB ═══ */}
          <TabsContent value="investments" className="space-y-6">
            <motion.div {...fadeUp()} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><Briefcase className="w-4 h-4 text-primary" /></div>
              <div>
                <h2 className="text-lg font-extrabold">Investment Portfolio</h2>
                <p className="text-[10px] text-muted-foreground">Track stocks, crypto, bonds & more</p>
              </div>
            </motion.div>
            <InvestmentTracker />
          </TabsContent>

          {/* ═══ SAVINGS TAB ═══ */}
          <TabsContent value="savings" className="space-y-6">
            <SavingsDashboard savingsGoals={savingsGoals} transactions={transactions} accounts={accounts} onRefresh={fetchData} />
          </TabsContent>

          {/* ═══ REPORTS TAB ═══ */}
          <TabsContent value="reports">
            <EnhancedReports transactions={transactions} accounts={accounts} categories={categories} budgets={budgets} savingsGoals={savingsGoals} />
          </TabsContent>

          {/* ═══ LEARN TAB ═══ */}
          <TabsContent value="learn" className="space-y-6">
            <FinancialLessons transactions={transactions} categories={categories} budgets={budgets} savingsGoals={savingsGoals} accounts={accounts} />
          </TabsContent>

          {/* ═══ ACTIVITY TAB — Calendar + Activity Log ═══ */}
          <TabsContent value="activity" className="space-y-6">
            <motion.div {...fadeUp()} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ScrollText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">Activity & Calendar</h2>
                <p className="text-[10px] text-muted-foreground">Full timeline, events, and audit trail</p>
              </div>
            </motion.div>

            {/* Financial Calendar */}
            <motion.div {...fadeUp(0.08)}>
              <FinancialCalendar transactions={transactions} budgets={budgets} savingsGoals={savingsGoals} />
            </motion.div>

            {/* Activity Log */}
            <motion.div {...fadeUp(0.16)}>
              <ActivityLog />
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile Bottom Navigation — scrollable to fit all tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border safe-area-bottom">
        <div className="flex items-center overflow-x-auto scrollbar-hide py-1.5 px-1 gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center gap-0.5 min-w-[3.5rem] px-2 py-1.5 rounded-xl transition-colors shrink-0 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {isActive && (
                  <motion.div layoutId="mobile-bottom-indicator" className="absolute -top-1.5 w-6 h-0.5 bg-primary rounded-full" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <Icon className="w-4.5 h-4.5" />
                <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                {item.badge === '!' && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button */}
      <FloatingTransactionForm accounts={accounts} categories={categories} onSuccess={fetchData} />
    </div>
  );
}
