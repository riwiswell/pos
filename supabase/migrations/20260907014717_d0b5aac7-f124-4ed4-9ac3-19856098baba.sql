CREATE TABLE public.daily_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_date date NOT NULL,
  source text NOT NULL DEFAULT 'free' CHECK (source IN ('habit','planner','free')),
  habit_id uuid REFERENCES public.habits(id) ON DELETE SET NULL,
  planner_item_id uuid REFERENCES public.planner_items(id) ON DELETE SET NULL,
  text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, focus_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_focus TO authenticated;
GRANT ALL ON public.daily_focus TO service_role;

ALTER TABLE public.daily_focus ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_focus_all_own ON public.daily_focus FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER daily_focus_set_updated_at BEFORE UPDATE ON public.daily_focus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();