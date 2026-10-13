-- Repair schema drift observed in the connected Personal OS database.
-- Add only the two tables required by existing modules; preserve all existing data.
create extension if not exists pgcrypto;

create table if not exists public.spiritual_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  progress numeric(5,2) not null default 0 check (progress >= 0 and progress <= 100),
  status text not null default 'active' check (status in ('active','completed','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.spiritual_goals enable row level security;
revoke all on table public.spiritual_goals from anon;
grant select,insert,update,delete on table public.spiritual_goals to authenticated;
drop policy if exists spiritual_goals_all_own on public.spiritual_goals;
create policy spiritual_goals_all_own on public.spiritual_goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop trigger if exists spiritual_goals_updated_at on public.spiritual_goals;
create trigger spiritual_goals_updated_at
  before update on public.spiritual_goals
  for each row execute function public.set_updated_at();
create index if not exists spiritual_goals_user_status_idx
  on public.spiritual_goals(user_id,status);

create table if not exists public.gamification_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  life_event_id uuid references public.life_events(id) on delete set null,
  event_key text not null,
  xp integer not null default 0 check (xp >= 0),
  reason text not null,
  created_at timestamptz not null default now(),
  unique(user_id,event_key)
);
alter table public.gamification_xp_events enable row level security;
revoke all on table public.gamification_xp_events from anon;
grant select,insert on table public.gamification_xp_events to authenticated;
drop policy if exists gamification_xp_events_all_own on public.gamification_xp_events;
create policy gamification_xp_events_all_own on public.gamification_xp_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create index if not exists gamification_xp_events_user_date_idx
  on public.gamification_xp_events(user_id,created_at desc);
