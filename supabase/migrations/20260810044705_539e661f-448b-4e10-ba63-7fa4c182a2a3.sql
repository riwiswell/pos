ALTER TABLE public.finance_accounts
  ADD COLUMN IF NOT EXISTS initial_balance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS transfer_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.finance_transactions DROP CONSTRAINT IF EXISTS finance_transactions_type_check;
ALTER TABLE public.finance_transactions
  ADD CONSTRAINT finance_transactions_type_check CHECK (type IN ('expense','income','transfer'));

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'habit';
ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_kind_check;
ALTER TABLE public.habits
  ADD CONSTRAINT habits_kind_check CHECK (kind IN ('habit','activity'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS background_url text,
  ADD COLUMN IF NOT EXISTS accent_color text;

DROP POLICY IF EXISTS "profile_media_select_own" ON storage.objects;
CREATE POLICY "profile_media_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "profile_media_insert_own" ON storage.objects;
CREATE POLICY "profile_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "profile_media_update_own" ON storage.objects;
CREATE POLICY "profile_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "profile_media_delete_own" ON storage.objects;
CREATE POLICY "profile_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);