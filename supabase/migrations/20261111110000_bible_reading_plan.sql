-- Bible reading: yearly plan is optional and each account keeps its own progress.
-- Append-only migration. Existing learning and spiritual history is untouched.

create table if not exists public.bible_reading_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null check (mode in ('annual_plan','free')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bible_reading_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  status text not null default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists bible_reading_one_active_cycle_per_user
  on public.bible_reading_cycles(user_id) where status = 'active';

create table if not exists public.bible_reading_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.bible_reading_cycles(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 365),
  completed_at timestamptz not null default now(),
  unique(cycle_id, day_number)
);

create index if not exists bible_reading_completions_user_cycle_idx
  on public.bible_reading_completions(user_id, cycle_id, day_number);

create table if not exists public.bible_free_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_date date not null default current_date,
  scripture_reference text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists bible_free_readings_user_date_idx
  on public.bible_free_readings(user_id, reading_date desc, created_at desc);

do $$
declare t text;
begin
  foreach t in array array[
    'bible_reading_preferences',
    'bible_reading_cycles',
    'bible_reading_completions',
    'bible_free_readings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists %I_all_own on public.%I', t, t);
    execute format(
      'create policy %I_all_own on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t, t
    );
  end loop;
end $$;

drop trigger if exists bible_reading_preferences_updated_at on public.bible_reading_preferences;
create trigger bible_reading_preferences_updated_at
before update on public.bible_reading_preferences
for each row execute function public.set_updated_at();

-- Ricardo and Angie receive the annual plan by default. Their reading cycle
-- starts when they explicitly press "Iniciar ciclo", so no start date is guessed.
insert into public.bible_reading_preferences(user_id, mode)
select id, 'annual_plan'
from auth.users
where lower(email) in ('riwiswell@gmail.com','angiediaz456@gmail.com')
on conflict (user_id) do nothing;

-- Make La Biblia visible in Libros for those two accounts, without duplicating
-- an existing Bible item or modifying any existing book data.
insert into public.learning_items(user_id, title, kind, status, progress, minutes_total, notes)
select u.id, 'La Biblia', 'book', 'active', 0, 0,
       'Lectura bíblica con plan anual de 365 días.'
from auth.users u
where lower(u.email) in ('riwiswell@gmail.com','angiediaz456@gmail.com')
  and not exists (
    select 1 from public.learning_items li
    where li.user_id = u.id
      and lower(trim(li.title)) in ('la biblia','biblia')
      and li.kind = 'book'
  );

-- Apply the same default to these two accounts if they register after migration.
create or replace function public.seed_default_bible_reading_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) in ('riwiswell@gmail.com','angiediaz456@gmail.com') then
    insert into public.bible_reading_preferences(user_id, mode)
    values(new.id, 'annual_plan')
    on conflict (user_id) do nothing;

    insert into public.learning_items(user_id, title, kind, status, progress, minutes_total, notes)
    select new.id, 'La Biblia', 'book', 'active', 0, 0,
           'Lectura bíblica con plan anual de 365 días.'
    where not exists (
      select 1 from public.learning_items li
      where li.user_id = new.id
        and lower(trim(li.title)) in ('la biblia','biblia')
        and li.kind = 'book'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists auth_user_seed_default_bible_reading on auth.users;
create trigger auth_user_seed_default_bible_reading
after insert on auth.users
for each row execute function public.seed_default_bible_reading_for_user();
