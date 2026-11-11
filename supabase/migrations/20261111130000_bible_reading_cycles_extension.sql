-- Extend the base Bible schema with per-book cycles, three daily checkboxes
-- and free-reading fields. Legacy one-checkbox days and free notes are preserved.

alter table public.bible_reading_cycles
  add column if not exists learning_item_id uuid references public.learning_items(id) on delete cascade;

alter table public.bible_reading_cycles
  add column if not exists mode text not null default 'annual_plan';

alter table public.bible_reading_cycles
  drop constraint if exists bible_reading_cycles_mode_check;

alter table public.bible_reading_cycles
  add constraint bible_reading_cycles_mode_check
  check (mode in ('annual_plan','free'));

-- Attach legacy cycles to the user's La Biblia item whenever it exists.
update public.bible_reading_cycles c
set learning_item_id = (
  select li.id
    from public.learning_items li
   where li.user_id=c.user_id
     and li.kind='book'
     and lower(trim(li.title)) in ('la biblia','biblia')
   order by li.created_at asc
   limit 1
)
where c.learning_item_id is null
  and exists (
    select 1
      from public.learning_items li
     where li.user_id=c.user_id
       and li.kind='book'
       and lower(trim(li.title)) in ('la biblia','biblia')
  );

create index if not exists bible_reading_cycles_user_item_idx
  on public.bible_reading_cycles(user_id,learning_item_id,created_at desc);

create table if not exists public.bible_reading_day_progress (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.bible_reading_cycles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 365),
  first_done boolean not null default false,
  second_done boolean not null default false,
  third_done boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(cycle_id,day_number)
);

create index if not exists bible_reading_day_progress_user_idx
  on public.bible_reading_day_progress(user_id,cycle_id,day_number);

-- Preserve all previously completed days: a legacy checked day represents
-- completion of that day's full reading set.
insert into public.bible_reading_day_progress(
  cycle_id,user_id,day_number,first_done,second_done,third_done,completed_at
)
select cycle_id,user_id,day_number,true,true,true,completed_at
from public.bible_reading_completions
on conflict(cycle_id,day_number) do nothing;

alter table public.bible_free_readings
  add column if not exists learning_item_id uuid references public.learning_items(id) on delete cascade,
  add column if not exists passage text,
  add column if not exists note text,
  add column if not exists scripture_reference text,
  add column if not exists notes text;

update public.bible_free_readings
set passage=coalesce(passage,scripture_reference),
    note=coalesce(note,notes)
where passage is null or note is null;

create index if not exists bible_free_readings_user_item_idx
  on public.bible_free_readings(user_id,learning_item_id,reading_date desc);

alter table public.bible_reading_day_progress enable row level security;
revoke all on public.bible_reading_day_progress from anon;
grant select,insert,update,delete on public.bible_reading_day_progress to authenticated;

drop policy if exists bible_reading_day_progress_all_own on public.bible_reading_day_progress;
create policy bible_reading_day_progress_all_own on public.bible_reading_day_progress
for all to authenticated
using ((select auth.uid())=user_id)
with check (
  (select auth.uid())=user_id
  and exists (
    select 1
      from public.bible_reading_cycles c
     where c.id=cycle_id
       and c.user_id=(select auth.uid())
       and c.mode='annual_plan'
  )
);
