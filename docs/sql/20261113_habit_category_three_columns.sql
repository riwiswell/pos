-- PERSONAL OS · Allow 1, 2 or 3 columns per Habits/Activities category.
-- Additive and non-destructive. Preserves every current category and habit record.
-- Run only in the CURRENT Lovable Supabase project: eutrhjvdyrakrxmjemut.
-- Never run against zavxenmtlxmykkcoordr.

begin;

alter table public.habit_categories
  add column if not exists layout_columns smallint not null default 1;

alter table public.habit_categories
  drop constraint if exists habit_categories_layout_columns_check;

alter table public.habit_categories
  add constraint habit_categories_layout_columns_check
  check (layout_columns in (1, 2, 3));

commit;

select id, name, layout_columns
from public.habit_categories
order by position, created_at;
