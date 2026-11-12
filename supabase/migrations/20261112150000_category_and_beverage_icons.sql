-- Personal OS: optional emoji icons for habit categories and hydration entries.
alter table public.habit_categories add column if not exists icon text;
alter table public.hydration_entries add column if not exists icon text;
