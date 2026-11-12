-- Daily menstrual observations are independent from period-level records.
-- Keep older period records untouched; symptoms are now captured per calendar day.
create table if not exists public.menstrual_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.menstrual_profiles(id) on delete cascade,
  log_date date not null,
  flow text not null default 'none',
  symptoms text[] not null default array[]::text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menstrual_daily_logs_flow_check
    check (flow in ('none','spotting','light','medium','heavy')),
  constraint menstrual_daily_logs_profile_date_key unique(profile_id, log_date)
);

create index if not exists menstrual_daily_logs_profile_date_idx
  on public.menstrual_daily_logs(profile_id, log_date desc);

alter table public.menstrual_daily_logs enable row level security;
revoke all on table public.menstrual_daily_logs from anon;
grant select, insert, update, delete on public.menstrual_daily_logs to authenticated;

drop policy if exists menstrual_daily_logs_all_own on public.menstrual_daily_logs;
create policy menstrual_daily_logs_all_own
  on public.menstrual_daily_logs
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.menstrual_profiles profile
      where profile.id = profile_id and profile.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.menstrual_profiles profile
      where profile.id = profile_id and profile.user_id = (select auth.uid())
    )
  );

drop trigger if exists menstrual_daily_logs_updated_at on public.menstrual_daily_logs;
create trigger menstrual_daily_logs_updated_at
  before update on public.menstrual_daily_logs
  for each row execute function public.set_updated_at();
