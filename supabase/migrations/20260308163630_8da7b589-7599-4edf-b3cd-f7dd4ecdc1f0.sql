
-- 1. Soft delete for transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- 2. Transaction edit history / versioning
CREATE TABLE IF NOT EXISTS public.transaction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  user_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  changed_fields jsonb NOT NULL DEFAULT '{}',
  old_values jsonb NOT NULL DEFAULT '{}',
  new_values jsonb NOT NULL DEFAULT '{}',
  changed_by text DEFAULT 'user',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transaction history" ON public.transaction_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transaction history" ON public.transaction_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. Account reconciliation
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_reconciled boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reconciled_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.reconciliation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  statement_balance numeric NOT NULL,
  system_balance numeric NOT NULL,
  difference numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  reconciled_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  notes text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reconciliation sessions" ON public.reconciliation_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reconciliation sessions" ON public.reconciliation_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reconciliation sessions" ON public.reconciliation_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reconciliation sessions" ON public.reconciliation_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON public.transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_not_deleted ON public.transactions(user_id, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON public.budgets(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_savings_allocations_goal ON public.savings_allocations(savings_goal_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_audit_log_account ON public.account_audit_log(account_id, created_at DESC);
