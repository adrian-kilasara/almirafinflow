
-- Exchange rates: remove permissive INSERT, restrict to service_role
DROP POLICY IF EXISTS "Authenticated users can insert rates" ON public.exchange_rates;
CREATE POLICY "Service role can insert rates"
  ON public.exchange_rates FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Savings allocations: require goal ownership on INSERT
DROP POLICY IF EXISTS "Users can insert their own savings allocations" ON public.savings_allocations;
CREATE POLICY "Users can insert their own savings allocations"
  ON public.savings_allocations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.savings_goals
      WHERE id = savings_goal_id AND user_id = auth.uid()
    )
  );

-- Account audit log: require account ownership on INSERT
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.account_audit_log;
CREATE POLICY "Users can insert their own audit logs"
  ON public.account_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_id AND user_id = auth.uid()
    )
  );

-- Transaction history: require transaction ownership on INSERT
DROP POLICY IF EXISTS "Users can insert their own transaction history" ON public.transaction_history;
CREATE POLICY "Users can insert their own transaction history"
  ON public.transaction_history FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

-- Avatars storage policies (private bucket; users scoped to their own folder)
DROP POLICY IF EXISTS "Users can view their own avatar" ON storage.objects;
CREATE POLICY "Users can view their own avatar"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Realtime messages: scope subscriptions to user-owned topics (topic must start with the user's UUID)
DROP POLICY IF EXISTS "Users can only access their own realtime topics" ON realtime.messages;
CREATE POLICY "Users can only access their own realtime topics"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    (realtime.topic() LIKE auth.uid()::text || ':%')
    OR (realtime.topic() = auth.uid()::text)
  );
