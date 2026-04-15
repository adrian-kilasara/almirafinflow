
-- Add loan metadata columns to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS interest_rate numeric NULL,
  ADD COLUMN IF NOT EXISTS loan_term_months integer NULL,
  ADD COLUMN IF NOT EXISTS loan_start_date date NULL,
  ADD COLUMN IF NOT EXISTS monthly_payment numeric NULL,
  ADD COLUMN IF NOT EXISTS loan_type text NULL,
  ADD COLUMN IF NOT EXISTS linked_account_id uuid NULL REFERENCES public.accounts(id);

-- Create index on linked_account_id
CREATE INDEX IF NOT EXISTS idx_accounts_linked_account ON public.accounts(linked_account_id) WHERE linked_account_id IS NOT NULL;

-- Create loan_payments table
CREATE TABLE public.loan_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  loan_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  principal_portion numeric NOT NULL DEFAULT 0,
  interest_portion numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  is_scheduled boolean NOT NULL DEFAULT false,
  transaction_id uuid NULL REFERENCES public.transactions(id),
  status text NOT NULL DEFAULT 'scheduled',
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own loan payments"
  ON public.loan_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loan payments"
  ON public.loan_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loan payments"
  ON public.loan_payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own loan payments"
  ON public.loan_payments FOR DELETE
  USING (auth.uid() = user_id);

-- Index for querying payments by loan
CREATE INDEX idx_loan_payments_loan_account ON public.loan_payments(loan_account_id);
CREATE INDEX idx_loan_payments_user ON public.loan_payments(user_id);
CREATE INDEX idx_loan_payments_status ON public.loan_payments(status);
