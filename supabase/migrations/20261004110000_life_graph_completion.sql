-- Incremental Life Graph completion. Applied after 20261004090000.
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