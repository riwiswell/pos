create extension if not exists pgcrypto;
create table if not exists public.alarms(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,description text,alarm_at timestamptz not null,repeat_rule text not null default 'once',enabled boolean not null default true,snoozed_until timestamptz,last_fired_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists alarms_user_time_idx on public.alarms(user_id,alarm_at);
create table if not exists public.health_metrics(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,metric_date date not null,weight_kg numeric(6,2),height_cm numeric(6,2),waist_cm numeric(6,2),body_fat_pct numeric(5,2),systolic integer,diastolic integer,resting_hr integer,sleep_hours numeric(4,2),exercise_minutes integer,water_liters numeric(5,2),notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index if not exists health_metrics_user_date_unique on public.health_metrics(user_id,metric_date);
-- shopping_lists / shopping_items already exist in the current remote schema; the module reuses them. 

create table if not exists public.learning_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,kind text not null default 'course',status text not null default 'active',progress numeric(5,2) not null default 0,target_date date,minutes_total integer not null default 0,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.relationships(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,relationship_type text,birthday date,anniversary date,importance integer not null default 3,last_contact_on date,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.work_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,kind text not null default 'task',status text not null default 'open',project text,client text,target_date date,minutes_worked integer not null default 0,amount numeric(12,2),notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.spiritual_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,entry_date date not null,kind text not null default 'reflection',title text,content text,minutes integer,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.ai_insights(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,insight_date date not null,kind text not null,title text not null,body text not null,score integer,source_snapshot jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table if not exists public.gamification_profiles(user_id uuid primary key references auth.users(id) on delete cascade,xp integer not null default 0,level integer not null default 1,updated_at timestamptz not null default now());
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['alarms','health_metrics','shopping_items','learning_items','relationships','work_items','spiritual_entries','gamification_profiles'] loop execute format('drop trigger if exists %I_updated_at on public.%I',t,t); execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['alarms','health_metrics','shopping_items','learning_items','relationships','work_items','spiritual_entries','ai_insights','gamification_profiles'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on table public.%I from anon',t); execute format('grant select,insert,update,delete on table public.%I to authenticated',t); execute format('drop policy if exists %I_select on public.%I',t,t); execute format('drop policy if exists %I_insert on public.%I',t,t); execute format('drop policy if exists %I_update on public.%I',t,t); execute format('drop policy if exists %I_delete on public.%I',t,t); execute format('create policy %I_select on public.%I for select to authenticated using ((select auth.uid())=user_id)',t,t); execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t,t); execute format('create policy %I_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t,t); execute format('create policy %I_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t,t); end loop; end $$;

-- Life Graph completion: body measurements, goals, learning sessions, meetings and motivation.
alter table public.health_metrics add column if not exists neck_cm numeric(6,2);
alter table public.health_metrics add column if not exists shoulders_cm numeric(6,2);
alter table public.health_metrics add column if not exists chest_cm numeric(6,2);
alter table public.health_metrics add column if not exists left_arm_cm numeric(6,2);
alter table public.health_metrics add column if not exists right_arm_cm numeric(6,2);
alter table public.health_metrics add column if not exists hips_cm numeric(6,2);
alter table public.health_metrics add column if not exists left_thigh_cm numeric(6,2);
alter table public.health_metrics add column if not exists right_thigh_cm numeric(6,2);
alter table public.health_metrics add column if not exists left_calf_cm numeric(6,2);
alter table public.health_metrics add column if not exists right_calf_cm numeric(6,2);

create table if not exists public.life_goals(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, area text, status text not null default 'active', progress numeric(5,2) not null default 0,
 target_date date, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.learning_sessions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 learning_item_id uuid references public.learning_items(id) on delete cascade, session_date date not null,
 minutes integer not null default 0, notes text, created_at timestamptz not null default now()
);
alter table public.learning_items add column if not exists author text;
alter table public.learning_items add column if not exists source_url text;
alter table public.learning_items add column if not exists language text;
alter table public.learning_items add column if not exists target_minutes integer not null default 0;

alter table public.work_items add column if not exists start_at timestamptz;
alter table public.work_items add column if not exists end_at timestamptz;
alter table public.work_items add column if not exists location text;
alter table public.work_items add column if not exists participants text;
alter table public.work_items add column if not exists objective text;

alter table public.relationships add column if not exists next_contact_on date;
alter table public.relationships add column if not exists contact_frequency_days integer;
alter table public.relationships add column if not exists favorite boolean not null default false;

alter table public.spiritual_entries add column if not exists prayer_answered boolean;
alter table public.spiritual_entries add column if not exists fasting boolean not null default false;

create table if not exists public.gamification_achievements(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 code text not null, title text not null, description text, xp_reward integer not null default 0,
 unlocked_at timestamptz, created_at timestamptz not null default now(), unique(user_id,code)
);
create table if not exists public.gamification_challenges(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, description text, target integer not null default 1, progress integer not null default 0,
 starts_on date, ends_on date, status text not null default 'active',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists learning_sessions_user_date_idx on public.learning_sessions(user_id,session_date);
create index if not exists life_goals_user_status_idx on public.life_goals(user_id,status);
do $$ declare t text; begin foreach t in array array['life_goals','learning_sessions','gamification_achievements','gamification_challenges'] loop execute format('alter table public.%I enable row level security',t); execute format('grant select,insert,update,delete on table public.%I to authenticated',t); execute format('drop policy if exists %I_all_own on public.%I',t,t); execute format('create policy %I_all_own on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t,t); end loop; end $$;
