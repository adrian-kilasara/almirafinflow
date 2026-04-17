ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS loan_account_id uuid;

CREATE INDEX IF NOT EXISTS idx_transactions_loan_account_id
ON public.transactions(loan_account_id)
WHERE loan_account_id IS NOT NULL;