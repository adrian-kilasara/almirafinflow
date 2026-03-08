export type AccountType = 'bank' | 'mobile_money' | 'cash' | 'investment' | 'crypto' | 'other';
export type AccountClassification = 'asset' | 'liability';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type CurrencyCode = 'KES' | 'TZS' | 'UGX' | 'RWF' | 'BIF' | 'ETB' | 'USD' | 'EUR' | 'GBP';
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  classification: AccountClassification;
  currency: CurrencyCode;
  balance: number;
  opening_balance: number;
  icon?: string;
  color?: string;
  is_active: boolean;
  is_archived: boolean;
  min_balance_alert?: number | null;
  institution_name?: string | null;
  account_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountAuditLog {
  id: string;
  account_id: string;
  user_id: string;
  action: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  amount?: number;
  balance_before?: number;
  balance_after?: number;
  notes?: string;
  created_at: string;
}

export interface Transfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  from_currency: string;
  to_currency: string;
  exchange_rate: number;
  converted_amount: number;
  from_transaction_id?: string;
  to_transaction_id?: string;
  description?: string;
  transfer_type: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id?: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  description?: string;
  date: string;
  notes?: string;
  tags?: string[];
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  account?: Account;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id?: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  period: BudgetPeriod;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  category?: Category;
  spent?: number;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: CurrencyCode;
  target_date?: string;
  icon?: string;
  color?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionRule {
  id: string;
  user_id: string;
  name: string;
  description_pattern: string;
  category_id?: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface UserStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date?: string;
  total_transactions: number;
  total_savings_added: number;
  created_at: string;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface FinancialLesson {
  id: string;
  title: string;
  content: string;
  category: string;
  difficulty: string;
  duration_minutes: number;
  order_index: number;
  created_at: string;
}

export interface UserLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed_at: string;
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  savingsRate: number;
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  KES: 'KSh',
  TZS: 'TSh',
  UGX: 'USh',
  RWF: 'FRw',
  BIF: 'FBu',
  ETB: 'Br',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  bank: '🏦',
  mobile_money: '📱',
  cash: '💵',
  investment: '📈',
  crypto: '₿',
  other: '💰',
};

export const ACCOUNT_CLASSIFICATION_LABELS: Record<AccountClassification, string> = {
  asset: 'Asset',
  liability: 'Liability',
};

export const BADGE_CATEGORIES = ['transactions', 'streaks', 'savings', 'budgets', 'accounts', 'health'] as const;

export const LESSON_CATEGORIES = ['basics', 'budgeting', 'savings', 'security', 'investing', 'business', 'tracking'] as const;
