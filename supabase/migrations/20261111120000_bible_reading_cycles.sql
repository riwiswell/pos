-- Bible reading cycles: annual plan or free reading, kept per user and Bible item.
create table if not exists public.bible_reading_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_item_id uuid not null references public.learning_items(id) on delete cascade,
  mode text not null check (mode in ('annual','free')),
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active','completed','archived')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists bible_reading_one_active_cycle_per_item_uidx
  on public.bible_reading_cycles(user_id,learning_item_id)
  where status='active';
create index if not exists bible_reading_cycles_user_idx
  on public.bible_reading_cycles(user_id,created_at desc);

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

create table if not exists public.bible_free_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_item_id uuid not null references public.learning_items(id) on delete cascade,
  reading_date date not null default current_date,
  passage text not null check (length(trim(passage)) between 1 and 300),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists bible_free_readings_user_date_idx
  on public.bible_free_readings(user_id,learning_item_id,reading_date desc);

alter table public.bible_reading_cycles enable row level security;
alter table public.bible_reading_day_progress enable row level security;
alter table public.bible_free_readings enable row level security;

revoke all on public.bible_reading_cycles,public.bible_reading_day_progress,public.bible_free_readings from anon;
grant select,insert,update,delete on public.bible_reading_cycles to authenticated;
grant select,insert,update,delete on public.bible_reading_day_progress to authenticated;
grant select,insert,update,delete on public.bible_free_readings to authenticated;

drop policy if exists bible_reading_cycles_select_own on public.bible_reading_cycles;
create policy bible_reading_cycles_select_own on public.bible_reading_cycles
  for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists bible_reading_cycles_insert_own on public.bible_reading_cycles;
create policy bible_reading_cycles_insert_own on public.bible_reading_cycles
  for insert to authenticated with check (
    (select auth.uid())=user_id
    and exists (
      select 1 from public.learning_items li
      where li.id=learning_item_id and li.user_id=(select auth.uid())
        and li.kind='book' and lower(trim(li.title))='la biblia'
    )
  );
drop policy if exists bible_reading_cycles_update_own on public.bible_reading_cycles;
create policy bible_reading_cycles_update_own on public.bible_reading_cycles
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
drop policy if exists bible_reading_cycles_delete_own on public.bible_reading_cycles;
create policy bible_reading_cycles_delete_own on public.bible_reading_cycles
  for delete to authenticated using ((select auth.uid())=user_id);

drop policy if exists bible_reading_progress_select_own on public.bible_reading_day_progress;
create policy bible_reading_progress_select_own on public.bible_reading_day_progress
  for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists bible_reading_progress_insert_own on public.bible_reading_day_progress;
create policy bible_reading_progress_insert_own on public.bible_reading_day_progress
  for insert to authenticated with check (
    (select auth.uid())=user_id
    and exists (
      select 1 from public.bible_reading_cycles c
      where c.id=cycle_id and c.user_id=(select auth.uid()) and c.mode='annual'
    )
  );
drop policy if exists bible_reading_progress_update_own on public.bible_reading_day_progress;
create policy bible_reading_progress_update_own on public.bible_reading_day_progress
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
drop policy if exists bible_reading_progress_delete_own on public.bible_reading_day_progress;
create policy bible_reading_progress_delete_own on public.bible_reading_day_progress
  for delete to authenticated using ((select auth.uid())=user_id);

drop policy if exists bible_free_readings_select_own on public.bible_free_readings;
create policy bible_free_readings_select_own on public.bible_free_readings
  for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists bible_free_readings_insert_own on public.bible_free_readings;
create policy bible_free_readings_insert_own on public.bible_free_readings
  for insert to authenticated with check (
    (select auth.uid())=user_id
    and exists (
      select 1 from public.learning_items li
      where li.id=learning_item_id and li.user_id=(select auth.uid())
        and li.kind='book' and lower(trim(li.title))='la biblia'
    )
  );
drop policy if exists bible_free_readings_update_own on public.bible_free_readings;
create policy bible_free_readings_update_own on public.bible_free_readings
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
drop policy if exists bible_free_readings_delete_own on public.bible_free_readings;
create policy bible_free_readings_delete_own on public.bible_free_readings
  for delete to authenticated using ((select auth.uid())=user_id);

-- Default the annual plan only for Ricardo and Angie. Other accounts will
-- choose annual or free reading in the UI when they add La Biblia.
insert into public.bible_reading_cycles(user_id,learning_item_id,mode,start_date)
select li.user_id,li.id,'annual',current_date
from public.learning_items li
join auth.users u on u.id=li.user_id
where li.kind='book'
  and lower(trim(li.title))='la biblia'
  and lower(u.email) in ('riwiswell@gmail.com','angiediaz456@gmail.com')
  and not exists (
    select 1 from public.bible_reading_cycles c
    where c.user_id=li.user_id and c.learning_item_id=li.id and c.status='active'
  );
