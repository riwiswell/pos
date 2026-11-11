-- Bible reading modes, annual plan progress and free reading history.
-- Append-only migration for Personal OS.

create table if not exists public.bible_reading_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null check (mode in ('annual_plan', 'free')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bible_reading_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_item_id uuid not null references public.learning_items(id) on delete cascade,
  mode text not null check (mode in ('annual_plan', 'free')),
  start_date date not null default current_date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'paused')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index if not exists bible_reading_one_active_cycle_per_book
  on public.bible_reading_cycles(user_id, learning_item_id)
  where status = 'active';

create index if not exists bible_reading_cycles_item_history_idx
  on public.bible_reading_cycles(learning_item_id, created_at desc);

create table if not exists public.bible_reading_day_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null,
  day_number integer not null check (day_number between 1 and 365),
  first_done boolean not null default false,
  second_done boolean not null default false,
  third_done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cycle_id, day_number),
  foreign key (cycle_id, user_id)
    references public.bible_reading_cycles(id, user_id)
    on delete cascade
);

create index if not exists bible_reading_progress_user_cycle_idx
  on public.bible_reading_day_progress(user_id, cycle_id, day_number);

create table if not exists public.bible_free_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_item_id uuid not null references public.learning_items(id) on delete cascade,
  reading_date date not null default current_date,
  passage text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists bible_free_readings_user_item_date_idx
  on public.bible_free_readings(user_id, learning_item_id, reading_date desc, created_at desc);

-- Keep the cycle and reading linked to a Bible book owned by the same account.
create or replace function public.ensure_bible_learning_item_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
      from public.learning_items li
     where li.id = new.learning_item_id
       and li.user_id = new.user_id
       and li.kind = 'book'
       and lower(trim(li.title)) in ('la biblia', 'biblia')
  ) then
    raise exception 'El registro debe estar vinculado a La Biblia de tu propia cuenta.';
  end if;
  return new;
end;
$$;

drop trigger if exists bible_reading_cycles_validate_owner on public.bible_reading_cycles;
create trigger bible_reading_cycles_validate_owner
before insert or update of user_id, learning_item_id
on public.bible_reading_cycles
for each row execute function public.ensure_bible_learning_item_owner();

drop trigger if exists bible_free_readings_validate_owner on public.bible_free_readings;
create trigger bible_free_readings_validate_owner
before insert or update of user_id, learning_item_id
on public.bible_free_readings
for each row execute function public.ensure_bible_learning_item_owner();

-- Account-scoped access. A user can never see or modify another account's Bible progress.
do $$
declare t text;
begin
  foreach t in array array[
    'bible_reading_preferences',
    'bible_reading_cycles',
    'bible_reading_day_progress',
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
end
$$;

drop trigger if exists bible_reading_preferences_updated_at on public.bible_reading_preferences;
create trigger bible_reading_preferences_updated_at
before update on public.bible_reading_preferences
for each row execute function public.set_updated_at();

-- Add La Biblia to Ricardo and Angie's Books by default, without duplicating
-- an existing entry or changing any existing book or reading history.
insert into public.learning_items(user_id, title, kind, status, progress, minutes_total, notes)
select u.id, 'La Biblia', 'book', 'active', 0, 0,
       'Plan anual disponible: 365 días, tres pasajes por día. También puedes elegir lectura libre.'
from auth.users u
where lower(coalesce(u.email, '')) in ('riwiswell@gmail.com', 'angiediaz456@gmail.com')
  and not exists (
    select 1
      from public.learning_items li
     where li.user_id = u.id
       and li.kind = 'book'
       and lower(trim(li.title)) in ('la biblia', 'biblia')
  );

-- Apply the same default to these two email accounts if they register later.
create or replace function public.seed_default_bible_book_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) in ('riwiswell@gmail.com', 'angiediaz456@gmail.com') then
    insert into public.learning_items(user_id, title, kind, status, progress, minutes_total, notes)
    select new.id, 'La Biblia', 'book', 'active', 0, 0,
           'Plan anual disponible: 365 días, tres pasajes por día. También puedes elegir lectura libre.'
    where not exists (
      select 1
        from public.learning_items li
       where li.user_id = new.id
         and li.kind = 'book'
         and lower(trim(li.title)) in ('la biblia', 'biblia')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists auth_user_seed_default_bible_book on auth.users;
create trigger auth_user_seed_default_bible_book
after insert on auth.users
for each row execute function public.seed_default_bible_book_for_user();
