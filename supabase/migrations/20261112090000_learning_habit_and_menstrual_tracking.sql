-- Personal OS: richer learning metadata, habit category icons and daily menstrual tracking.
-- Existing learning, habit and menstrual records are preserved.

ALTER TABLE public.habit_categories
  ADD COLUMN IF NOT EXISTS icon text;

ALTER TABLE public.learning_items
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS genre text;

ALTER TABLE public.learning_items
  DROP CONSTRAINT IF EXISTS learning_items_platform_check,
  DROP CONSTRAINT IF EXISTS learning_items_genre_check;

ALTER TABLE public.learning_items
  ADD CONSTRAINT learning_items_platform_check
    CHECK (platform IS NULL OR length(platform) <= 80),
  ADD CONSTRAINT learning_items_genre_check
    CHECK (genre IS NULL OR length(genre) <= 80);

CREATE TABLE IF NOT EXISTS public.menstrual_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.menstrual_profiles(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.menstrual_records(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  flow text CHECK (flow IS NULL OR flow IN ('none','spotting','light','medium','heavy')),
  symptoms text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(record_id, log_date)
);

CREATE INDEX IF NOT EXISTS menstrual_daily_logs_user_profile_date_idx
  ON public.menstrual_daily_logs(user_id, profile_id, log_date DESC);

CREATE OR REPLACE FUNCTION public.validate_menstrual_daily_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  period_row record;
BEGIN
  SELECT user_id, profile_id, start_date, end_date
    INTO period_row
  FROM public.menstrual_records
  WHERE id = NEW.record_id;

  IF NOT FOUND
     OR period_row.user_id <> NEW.user_id
     OR period_row.profile_id <> NEW.profile_id THEN
    RAISE EXCEPTION 'El registro diario no pertenece a este perfil.';
  END IF;

  IF NEW.log_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'No puedes registrar síntomas en una fecha futura.';
  END IF;

  IF NEW.log_date < period_row.start_date
     OR (period_row.end_date IS NOT NULL AND NEW.log_date > period_row.end_date) THEN
    RAISE EXCEPTION 'La fecha debe estar dentro del período registrado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS menstrual_daily_logs_validate ON public.menstrual_daily_logs;
CREATE TRIGGER menstrual_daily_logs_validate
  BEFORE INSERT OR UPDATE OF user_id, profile_id, record_id, log_date
  ON public.menstrual_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_menstrual_daily_log();

DROP TRIGGER IF EXISTS menstrual_daily_logs_updated_at ON public.menstrual_daily_logs;
CREATE TRIGGER menstrual_daily_logs_updated_at
  BEFORE UPDATE ON public.menstrual_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.menstrual_daily_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.menstrual_daily_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.menstrual_daily_logs TO authenticated;

DROP POLICY IF EXISTS menstrual_daily_logs_select_own ON public.menstrual_daily_logs;
DROP POLICY IF EXISTS menstrual_daily_logs_insert_own ON public.menstrual_daily_logs;
DROP POLICY IF EXISTS menstrual_daily_logs_update_own ON public.menstrual_daily_logs;
DROP POLICY IF EXISTS menstrual_daily_logs_delete_own ON public.menstrual_daily_logs;

CREATE POLICY menstrual_daily_logs_select_own ON public.menstrual_daily_logs
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY menstrual_daily_logs_insert_own ON public.menstrual_daily_logs
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY menstrual_daily_logs_update_own ON public.menstrual_daily_logs
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY menstrual_daily_logs_delete_own ON public.menstrual_daily_logs
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.menstrual_daily_logs IS
  'Daily flow, symptoms and notes attached to one menstrual period and date.';
