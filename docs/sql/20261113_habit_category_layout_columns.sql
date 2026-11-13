-- Personal OS
-- Add a per-category layout preference for Habits / Activities.
-- Safe, additive migration: no habits, logs, categories, or history are deleted.
-- Run this manually in the SQL Editor of the CURRENT Lovable Supabase project:
-- eutrhjvdyrakrxmjemut
-- Do NOT run against zavxenmtlxmykkcoordr.

begin;

alter table public.habit_categories
  add column if not exists layout_columns smallint not null default 1;

alter table public.habit_categories
  alter column layout_columns set default 1;

update public.habit_categories
set layout_columns = 1
where layout_columns is null;

alter table public.habit_categories
  alter column layout_columns set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'habit_categories_layout_columns_check'
      and conrelid = 'public.habit_categories'::regclass
  ) then
    alter table public.habit_categories
      add constraint habit_categories_layout_columns_check
      check (layout_columns in (1, 2));
  end if;
end
$$;

commit;

-- Verification:
select id, name, layout_columns
from public.habit_categories
order by position, created_at;
