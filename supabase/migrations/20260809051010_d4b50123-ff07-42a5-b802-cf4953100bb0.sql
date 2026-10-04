-- ACCOUNTS
CREATE TABLE public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Wallet',
  color text NOT NULL DEFAULT '#7dd3fc',
  note text,
  include_in_total boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounts TO authenticated;
GRANT ALL ON public.finance_accounts TO service_role;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_accounts_all_own ON public.finance_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER finance_accounts_set_updated_at BEFORE UPDATE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CATEGORIES
CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense','income')),
  icon text NOT NULL DEFAULT 'Tag',
  color text NOT NULL DEFAULT '#a5b4fc',
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_categories_all_own ON public.finance_categories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER finance_categories_set_updated_at BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRANSACTIONS
CREATE TABLE public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('expense','income')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  cost_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (cost_amount >= 0),
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  occurred_on date NOT NULL,
  occurred_time time,
  note text,
  tags text[] NOT NULL DEFAULT '{}',
  photos text[] NOT NULL DEFAULT '{}',
  counts_for_tithe boolean NOT NULL DEFAULT false,
  is_tithe_payment boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated;
GRANT ALL ON public.finance_transactions TO service_role;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_transactions_all_own ON public.finance_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER finance_transactions_set_updated_at BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX finance_transactions_user_date_idx ON public.finance_transactions (user_id, occurred_on DESC, occurred_time DESC NULLS LAST, created_at DESC);
CREATE INDEX finance_transactions_account_idx ON public.finance_transactions (account_id);
CREATE INDEX finance_transactions_category_idx ON public.finance_transactions (category_id);

-- SETTINGS
CREATE TABLE public.finance_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tithe_percent numeric(6,3) NOT NULL DEFAULT 10 CHECK (tithe_percent >= 0 AND tithe_percent <= 100),
  tithe_basis text NOT NULL DEFAULT 'marked' CHECK (tithe_basis IN ('all_income','net_income','marked','custom')),
  tithe_custom_note text,
  show_money_in_dashboard boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_settings_all_own ON public.finance_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER finance_settings_set_updated_at BEFORE UPDATE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BOOTSTRAP FOR NEW USERS (Efectivo + settings)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.finance_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.finance_accounts (user_id, name, icon, color, position)
  VALUES (NEW.id, 'Efectivo', 'Banknote', '#34d399', 0);

  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill existing users
INSERT INTO public.finance_settings (user_id)
SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.finance_accounts (user_id, name, icon, color, position)
SELECT u.id, 'Efectivo', 'Banknote', '#34d399', 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.finance_accounts a WHERE a.user_id = u.id);

-- PHOTO STORAGE POLICIES (private bucket finance-photos)
CREATE POLICY "finance_photos_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'finance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "finance_photos_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "finance_photos_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'finance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "finance_photos_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'finance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);