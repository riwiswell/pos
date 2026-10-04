CREATE TABLE public.planner_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7dd3fc',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_categories TO authenticated;
GRANT ALL ON public.planner_categories TO service_role;
ALTER TABLE public.planner_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY planner_categories_all_own ON public.planner_categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX planner_categories_user_name_uidx ON public.planner_categories (user_id, lower(btrim(name)));

CREATE TABLE public.planner_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.planner_categories(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'task' CHECK (type IN ('task','event')),
  title text NOT NULL,
  description text,
  scheduled_on date NOT NULL,
  start_time time,
  end_time time,
  due_on date,
  location text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','important','urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_items TO authenticated;
GRANT ALL ON public.planner_items TO service_role;
ALTER TABLE public.planner_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY planner_items_all_own ON public.planner_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX planner_items_user_date_idx ON public.planner_items (user_id, scheduled_on);

CREATE TRIGGER planner_categories_set_updated_at BEFORE UPDATE ON public.planner_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER planner_items_set_updated_at BEFORE UPDATE ON public.planner_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();