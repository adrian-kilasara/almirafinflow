
-- User settings table for all configurable preferences
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  
  -- Localization
  date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  timezone text NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  financial_year_start text NOT NULL DEFAULT 'january',
  language text NOT NULL DEFAULT 'en',
  
  -- Financial Rules
  budget_mode text NOT NULL DEFAULT 'flexible',
  budget_rollover boolean NOT NULL DEFAULT false,
  savings_round_up boolean NOT NULL DEFAULT false,
  savings_auto_percentage numeric DEFAULT NULL,
  debt_strategy text NOT NULL DEFAULT 'avalanche',
  
  -- Health Score Weights (0-100, must sum to 100)
  health_weight_savings integer NOT NULL DEFAULT 30,
  health_weight_debt integer NOT NULL DEFAULT 25,
  health_weight_investments integer NOT NULL DEFAULT 20,
  health_weight_cashflow integer NOT NULL DEFAULT 25,
  
  -- AI & Insights
  ai_enabled boolean NOT NULL DEFAULT true,
  ai_advice_mode text NOT NULL DEFAULT 'balanced',
  ai_risk_tolerance text NOT NULL DEFAULT 'moderate',
  insight_frequency text NOT NULL DEFAULT 'daily',
  
  -- Notifications
  notify_low_balance boolean NOT NULL DEFAULT true,
  notify_budget_exceeded boolean NOT NULL DEFAULT true,
  notify_debt_reminder boolean NOT NULL DEFAULT true,
  notify_goal_progress boolean NOT NULL DEFAULT true,
  notify_risk_alerts boolean NOT NULL DEFAULT true,
  notify_weekly_summary boolean NOT NULL DEFAULT true,
  notify_monthly_report boolean NOT NULL DEFAULT true,
  low_balance_threshold numeric NOT NULL DEFAULT 10000,
  
  -- Display
  theme text NOT NULL DEFAULT 'dark',
  dashboard_density text NOT NULL DEFAULT 'comfortable',
  default_landing_tab text NOT NULL DEFAULT 'overview',
  chart_preference text NOT NULL DEFAULT 'bar',
  
  -- Advanced
  realtime_recalculation boolean NOT NULL DEFAULT true,
  performance_mode boolean NOT NULL DEFAULT false,
  data_cache_days integer NOT NULL DEFAULT 30,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create settings on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (new.id);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();

-- Add phone and financial_year_start to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone text DEFAULT NULL;
