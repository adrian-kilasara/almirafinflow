import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { setGlobalCurrency, setGlobalDateFormat } from '@/lib/format';
import type { CurrencyCode } from '@/types/finance';

export interface UserSettings {
  // Profile (from profiles table)
  default_currency: CurrencyCode;
  full_name: string | null;
  phone: string | null;
  username: string | null;
  dob: string | null;
  gender: string | null;
  avatar_url: string | null;

  // Localization (from user_settings table)
  date_format: string;
  timezone: string;
  financial_year_start: string;
  language: string;

  // Financial Rules
  budget_mode: 'strict' | 'flexible';
  budget_rollover: boolean;
  savings_round_up: boolean;
  savings_auto_percentage: number | null;
  debt_strategy: 'avalanche' | 'snowball' | 'custom';

  // Health Score Weights
  health_weight_savings: number;
  health_weight_debt: number;
  health_weight_investments: number;
  health_weight_cashflow: number;

  // AI & Insights
  ai_enabled: boolean;
  ai_advice_mode: 'conservative' | 'balanced' | 'aggressive';
  ai_risk_tolerance: 'low' | 'moderate' | 'high';
  insight_frequency: 'daily' | 'weekly' | 'monthly';

  // Notifications
  notify_low_balance: boolean;
  notify_budget_exceeded: boolean;
  notify_debt_reminder: boolean;
  notify_goal_progress: boolean;
  notify_risk_alerts: boolean;
  notify_weekly_summary: boolean;
  notify_monthly_report: boolean;
  low_balance_threshold: number;

  // Display
  theme: 'dark' | 'light' | 'system';
  dashboard_density: 'compact' | 'comfortable' | 'detailed';
  default_landing_tab: string;
  chart_preference: 'bar' | 'line' | 'area' | 'pie';

  // Advanced
  realtime_recalculation: boolean;
  performance_mode: boolean;
  data_cache_days: number;
}

interface SettingsContextType {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  default_currency: 'KES',
  full_name: null,
  phone: null,
  avatar_url: null,
  username: null,
  dob: null,
  gender: null,
  date_format: 'DD/MM/YYYY',
  timezone: 'Africa/Dar_es_Salaam',
  financial_year_start: 'january',
  language: 'en',
  budget_mode: 'flexible',
  budget_rollover: false,
  savings_round_up: false,
  savings_auto_percentage: null,
  debt_strategy: 'avalanche',
  health_weight_savings: 30,
  health_weight_debt: 25,
  health_weight_investments: 20,
  health_weight_cashflow: 25,
  ai_enabled: true,
  ai_advice_mode: 'balanced',
  ai_risk_tolerance: 'moderate',
  insight_frequency: 'daily',
  notify_low_balance: true,
  notify_budget_exceeded: true,
  notify_debt_reminder: true,
  notify_goal_progress: true,
  notify_risk_alerts: true,
  notify_weekly_summary: true,
  notify_monthly_report: true,
  low_balance_threshold: 10000,
  theme: 'dark',
  dashboard_density: 'comfortable',
  default_landing_tab: 'overview',
  chart_preference: 'bar',
  realtime_recalculation: true,
  performance_mode: false,
  data_cache_days: 30,
};

const PROFILE_FIELDS = ['default_currency', 'full_name', 'phone', 'avatar_url'] as const;
const SETTINGS_FIELDS = [
  'date_format', 'timezone', 'financial_year_start', 'language',
  'budget_mode', 'budget_rollover', 'savings_round_up', 'savings_auto_percentage', 'debt_strategy',
  'health_weight_savings', 'health_weight_debt', 'health_weight_investments', 'health_weight_cashflow',
  'ai_enabled', 'ai_advice_mode', 'ai_risk_tolerance', 'insight_frequency',
  'notify_low_balance', 'notify_budget_exceeded', 'notify_debt_reminder', 'notify_goal_progress',
  'notify_risk_alerts', 'notify_weekly_summary', 'notify_monthly_report', 'low_balance_threshold',
  'theme', 'dashboard_density', 'default_landing_tab', 'chart_preference',
  'realtime_recalculation', 'performance_mode', 'data_cache_days',
] as const;

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGlobalCurrency(settings.default_currency);
    setGlobalDateFormat(settings.date_format);
  }, [settings.default_currency, settings.date_format]);

  const loadSettings = useCallback(async () => {
    if (!user) {
      setSettings(defaultSettings);
      setLoading(false);
      return;
    }

    try {
      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('default_currency, full_name, phone, avatar_url').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      const merged = { ...defaultSettings };

      if (profileRes.data) {
        merged.default_currency = profileRes.data.default_currency || 'KES';
        merged.full_name = profileRes.data.full_name;
        merged.phone = (profileRes.data as any).phone || null;
        merged.avatar_url = profileRes.data.avatar_url;
      }

      if (settingsRes.data) {
        const s = settingsRes.data as any;
        for (const key of SETTINGS_FIELDS) {
          if (s[key] !== undefined && s[key] !== null) {
            (merged as any)[key] = s[key];
          }
        }
      }

      setSettings(merged);
      setGlobalCurrency(merged.default_currency);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    if (!user) return;

    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    if (newSettings.default_currency) {
      setGlobalCurrency(newSettings.default_currency);
    }

    try {
      // Split updates between profiles and user_settings tables
      const profileUpdate: Record<string, any> = {};
      const settingsUpdate: Record<string, any> = {};

      for (const [key, value] of Object.entries(newSettings)) {
        if ((PROFILE_FIELDS as readonly string[]).includes(key)) {
          profileUpdate[key] = value;
        } else if ((SETTINGS_FIELDS as readonly string[]).includes(key)) {
          settingsUpdate[key] = value;
        }
      }

      const promises: Promise<any>[] = [];

      if (Object.keys(profileUpdate).length > 0) {
        promises.push(
          supabase.from('profiles').update(profileUpdate).eq('user_id', user.id).select() as any
        );
      }

      if (Object.keys(settingsUpdate).length > 0) {
        promises.push(
          supabase.from('user_settings').upsert(
            { user_id: user.id, ...settingsUpdate, updated_at: new Date().toISOString() } as any,
            { onConflict: 'user_id' }
          ).select() as any
        );
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to update settings:', error);
      loadSettings(); // Revert on error
    }
  }, [user, settings, loadSettings]);

  const refreshSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
