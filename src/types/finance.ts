export type AccountType = 'bank' | 'mobile_money' | 'cash' | 'investment' | 'crypto' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type CurrencyCode = 'KES' | 'TZS' | 'UGX' | 'RWF' | 'BIF' | 'ETB' | 'USD' | 'EUR' | 'GBP';
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  balance: number;
  icon?: string;
  color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
