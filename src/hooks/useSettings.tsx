import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { setGlobalCurrency } from '@/lib/format';
import type { CurrencyCode } from '@/types/finance';

interface UserSettings {
  default_currency: CurrencyCode;
  budget_alerts: boolean;
  weekly_reports: boolean;
  savings_reminders: boolean;
  daily_tips: boolean;
}

interface SettingsContextType {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  default_currency: 'KES',
  budget_alerts: true,
  weekly_reports: true,
  savings_reminders: true,
  daily_tips: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Sync global currency whenever settings change
  useEffect(() => {
    setGlobalCurrency(settings.default_currency);
  }, [settings.default_currency]);

  const loadSettings = async () => {
    if (!user) {
      setSettings(defaultSettings);
      setLoading(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('default_currency')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        const newCurrency = profile.default_currency || 'KES';
        setSettings(prev => ({
          ...prev,
          default_currency: newCurrency,
        }));
        setGlobalCurrency(newCurrency);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;

    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    // Immediately update global currency for system-wide effect
    if (newSettings.default_currency) {
      setGlobalCurrency(newSettings.default_currency);
    }

    try {
      if (newSettings.default_currency !== undefined) {
        await supabase
          .from('profiles')
          .update({ default_currency: newSettings.default_currency })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      // Revert on error
      loadSettings();
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

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
