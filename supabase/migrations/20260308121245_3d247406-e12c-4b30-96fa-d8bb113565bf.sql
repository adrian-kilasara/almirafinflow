
-- 1. Add new columns to accounts table
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'asset',
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_balance_alert numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS opening_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS institution_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS account_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

-- 2. Create account_audit_log table
CREATE TABLE IF NOT EXISTS public.account_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  amount numeric,
  balance_before numeric,
  balance_after numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS on audit log
ALTER TABLE public.account_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON public.account_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit logs"
  ON public.account_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Create transfers table for dual-entry transfers
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  from_currency text NOT NULL DEFAULT 'TZS',
  to_currency text NOT NULL DEFAULT 'TZS',
  exchange_rate numeric NOT NULL DEFAULT 1,
  converted_amount numeric NOT NULL,
  from_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  to_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  description text,
  transfer_type text NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transfers"
  ON public.transfers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transfers"
  ON public.transfers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transfers"
  ON public.transfers FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_account_id ON public.account_audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.account_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON public.transactions(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_user_classification ON public.accounts(user_id, classification);
