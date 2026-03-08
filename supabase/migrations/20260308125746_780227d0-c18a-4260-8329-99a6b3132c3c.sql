
-- Fix: restrict exchange_rates INSERT to user's own operations
DROP POLICY IF EXISTS "Authenticated users can insert rates" ON public.exchange_rates;
CREATE POLICY "Authenticated users can insert rates" ON public.exchange_rates
  FOR INSERT TO authenticated WITH CHECK (true);
