-- Base schema for the personal Bible reading experience.
-- The next migration attaches cycles to the La Biblia book and adds the
-- three independent daily reading checkboxes.

create table if not exists public.bible_reading_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'annual_plan'
    check (mode in ('annual_plan','free')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bible_reading_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'annual_plan',
  start_date date not null default current_date,
  status text not null default 'active'
    check (status in ('active','completed','paused')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bible_reading_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.bible_reading_cycles(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 365),
  completed_at timestamptz not null default now(),
  unique(cycle_id,day_number)
);

create table if not exists public.bible_free_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_date date not null default current_date,
  scripture_reference text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists bible_reading_cycles_user_history_idx
  on public.bible_reading_cycles(user_id,created_at desc);
create index if not exists bible_reading_completions_user_cycle_idx
  on public.bible_reading_completions(user_id,cycle_id,day_number);
create index if not exists bible_free_readings_user_date_idx
  on public.bible_free_readings(user_id,reading_date desc,created_at desc);

drop trigger if exists bible_reading_preferences_updated_at on public.bible_reading_preferences;
create trigger bible_reading_preferences_updated_at
before update on public.bible_reading_preferences
for each row execute function public.set_updated_at();

-- Owner-only access to private reading settings and history.
do $$
declare t text;
begin
  foreach t in array array[
    'bible_reading_preferences',
    'bible_reading_cycles',
    'bible_reading_completions',
    'bible_free_readings'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon',t);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
    execute format('drop policy if exists %I_all_own on public.%I',t,t);
    execute format(
      'create policy %I_all_own on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',
      t,t
    );
  end loop;
end
$$;

-- Add La Biblia for Ricardo and Angie by default, without duplicating a book.
insert into public.learning_items(user_id,title,kind,status,progress,minutes_total,notes)
select u.id,'La Biblia','book','active',0,0,
       'Plan anual de 365 días o lectura libre.'
from auth.users u
where lower(coalesce(u.email,'')) in ('riwiswell@gmail.com','angiediaz456@gmail.com')
  and not exists (
    select 1 from public.learning_items li
    where li.user_id=u.id and li.kind='book'
      and lower(trim(li.title)) in ('la biblia','biblia')
  );

create or replace function public.seed_default_bible_book_for_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if lower(coalesce(new.email,'')) in ('riwiswell@gmail.com','angiediaz456@gmail.com') then
    insert into public.learning_items(user_id,title,kind,status,progress,minutes_total,notes)
    select new.id,'La Biblia','book','active',0,0,
           'Plan anual de 365 días o lectura libre.'
    where not exists (
      select 1 from public.learning_items li
      where li.user_id=new.id and li.kind='book'
        and lower(trim(li.title)) in ('la biblia','biblia')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists auth_user_seed_default_bible_book on auth.users;
create trigger auth_user_seed_default_bible_book
after insert on auth.users
for each row execute function public.seed_default_bible_book_for_user();
