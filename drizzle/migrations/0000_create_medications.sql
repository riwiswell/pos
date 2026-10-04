CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  dose numeric,
  unit text,
  frequency text NOT NULL DEFAULT 'daily',
  times text[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  remind_offset_min integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY medications_all_own ON public.medications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER medications_set_updated_at BEFORE UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.medication_doses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  dose_date date NOT NULL,
  scheduled_time text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  taken_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, dose_date, scheduled_time)
);
CREATE INDEX medication_doses_user_date_idx ON public.medication_doses(user_id, dose_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_doses TO authenticated;
GRANT ALL ON public.medication_doses TO service_role;
ALTER TABLE public.medication_doses ENABLE ROW LEVEL SECURITY;
CREATE POLICY medication_doses_all_own ON public.medication_doses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER medication_doses_set_updated_at BEFORE UPDATE ON public.medication_doses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();