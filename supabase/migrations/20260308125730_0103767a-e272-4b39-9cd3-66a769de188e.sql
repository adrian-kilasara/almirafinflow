
-- ============================================
-- 1. PERFORMANCE INDEXES for transactions
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON public.transactions (user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions (user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON public.transactions (user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_merchant ON public.transactions (user_id, merchant);
CREATE INDEX IF NOT EXISTS idx_savings_allocations_goal ON public.savings_allocations (savings_goal_id);
CREATE INDEX IF NOT EXISTS idx_account_audit_log_account ON public.account_audit_log (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON public.budgets (user_id, category_id);

-- ============================================
-- 2. NOTIFICATIONS table (persistent alerts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  module text NOT NULL DEFAULT 'system',
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- 3. EXCHANGE_RATES table (multi-currency)
-- ============================================
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency, effective_date)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rates" ON public.exchange_rates
  FOR INSERT TO authenticated WITH CHECK (true);

-- Seed initial TZS/USD/KES rates
INSERT INTO public.exchange_rates (from_currency, to_currency, rate, source)
VALUES
  ('USD', 'TZS', 2650, 'seed'),
  ('TZS', 'USD', 0.000377, 'seed'),
  ('USD', 'KES', 153, 'seed'),
  ('KES', 'USD', 0.00654, 'seed'),
  ('TZS', 'KES', 0.0577, 'seed'),
  ('KES', 'TZS', 17.32, 'seed'),
  ('USD', 'UGX', 3750, 'seed'),
  ('USD', 'RWF', 1350, 'seed'),
  ('USD', 'EUR', 0.92, 'seed'),
  ('USD', 'GBP', 0.79, 'seed'),
  ('EUR', 'USD', 1.087, 'seed'),
  ('GBP', 'USD', 1.266, 'seed')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. RECURRING_SCHEDULES table
-- ============================================
CREATE TABLE IF NOT EXISTS public.recurring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'transaction',
  template_data jsonb NOT NULL DEFAULT '{}',
  frequency text NOT NULL DEFAULT 'monthly',
  next_run_date date NOT NULL,
  last_run_date date,
  is_active boolean NOT NULL DEFAULT true,
  total_runs integer NOT NULL DEFAULT 0,
  max_runs integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own schedules" ON public.recurring_schedules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own schedules" ON public.recurring_schedules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own schedules" ON public.recurring_schedules
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own schedules" ON public.recurring_schedules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- 5. Enable realtime on notifications
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
