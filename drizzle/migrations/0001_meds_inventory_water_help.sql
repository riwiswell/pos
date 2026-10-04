ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS total_quantity numeric;
ALTER TABLE public.medication_doses ADD COLUMN IF NOT EXISTS water_glasses numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS help_enabled boolean NOT NULL DEFAULT true;