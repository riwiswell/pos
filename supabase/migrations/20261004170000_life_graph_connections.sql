-- Personal OS cross-domain relationships + project capture + precise medication timing.
-- Append-only migration. Never edit an applied migration.

create table if not exists public.life_links(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_type text not null,
  from_id uuid not null,
  to_type text not null,
  to_id uuid not null,
  relation text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,from_type,from_id,to_type,to_id,relation)
);
create index if not exists life_links_from_idx on public.life_links(user_id,from_type,from_id);
create index if not exists life_links_to_idx on public.life_links(user_id,to_type,to_id);
alter table public.life_links enable row level security;
revoke all on table public.life_links from anon;
grant select,insert,update,delete on table public.life_links to authenticated;
drop policy if exists life_links_all_own on public.life_links;
create policy life_links_all_own on public.life_links for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- A journal idea/capture may become a work project without losing its origin.
alter table public.journal_entries add column if not exists linked_work_item_id uuid references public.work_items(id) on delete set null;
alter table public.journal_entries add column if not exists capture_stage text not null default 'captured';
alter table public.work_items add column if not exists parent_work_item_id uuid references public.work_items(id) on delete set null;
alter table public.work_items add column if not exists source_journal_entry_id uuid references public.journal_entries(id) on delete set null;
alter table public.work_items add column if not exists estimated_minutes integer;
create index if not exists work_items_parent_idx on public.work_items(user_id,parent_work_item_id);

-- Precise focus sessions: start/stop, actual duration and a break reminder.
alter table public.work_sessions add column if not exists started_at timestamptz;
alter table public.work_sessions add column if not exists ended_at timestamptz;
alter table public.work_sessions add column if not exists status text not null default 'completed';
alter table public.work_sessions add column if not exists target_minutes integer not null default 50;
alter table public.work_sessions add column if not exists break_notified_at timestamptz;
create index if not exists work_sessions_active_idx on public.work_sessions(user_id,status,started_at);

create or replace function public.finalize_work_session_minutes()
returns trigger language plpgsql as $$
begin
  if new.started_at is not null and new.ended_at is not null then
    new.minutes := greatest(0, round(extract(epoch from (new.ended_at-new.started_at))/60.0)::integer);
    new.status := 'completed';
  end if;
  return new;
end $$;
drop trigger if exists finalize_work_session_minutes on public.work_sessions;
create trigger finalize_work_session_minutes before insert or update on public.work_sessions
for each row execute function public.finalize_work_session_minutes();

create or replace function public.schedule_work_break_notification()
returns trigger language plpgsql as $$
declare fire_at timestamptz;
begin
  if new.started_at is not null and (tg_op='INSERT' or old.started_at is distinct from new.started_at or old.target_minutes is distinct from new.target_minutes) then
    delete from public.notification_jobs where user_id=new.user_id and source_type='work_session' and source_id=new.id and status='pending';
    fire_at := new.started_at + make_interval(mins=>greatest(1,new.target_minutes));
    insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
    values(new.user_id,'work_session',new.id,fire_at,'Pausa de trabajo','Llevas un bloque largo de trabajo. Tómate unos minutos para descansar.',jsonb_build_object('kind','work_break','target_minutes',new.target_minutes));
  end if;
  return new;
end $$;
drop trigger if exists schedule_work_break_notification on public.work_sessions;
create trigger schedule_work_break_notification after insert or update of started_at,target_minutes,status on public.work_sessions
for each row execute function public.schedule_work_break_notification();

-- Language variant belongs to the language profile, not a separate language.
alter table public.language_profiles add column if not exists locale_code text;
alter table public.language_profiles add column if not exists country_name text;
create index if not exists language_profiles_locale_idx on public.language_profiles(user_id,language_code,locale_code);

-- Flexible late-taking: retain the scheduled dose and the actual moment separately.
alter table public.medication_doses add column if not exists taken_time_source text not null default 'recorded';
