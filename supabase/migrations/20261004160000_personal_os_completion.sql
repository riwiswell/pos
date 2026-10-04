-- PERSONAL OS completion schema
-- Append-only migration. Never edit prior migrations.
create extension if not exists pgcrypto;

alter table public.profiles add column if not exists module_order text[] not null default array['inicio','habitos','planeador','salud','finanzas','diario','alarmas','vida','aprendizaje','relaciones','trabajo','espiritualidad','ia','gamificacion','perfil'];
alter table public.profiles add column if not exists hidden_modules text[] not null default array[]::text[];
alter table public.profiles add column if not exists hidden_features jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists dashboard_widgets jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

create table if not exists public.life_goals(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, area text, status text not null default 'active', progress numeric(5,2) not null default 0,
 target_date date, notes text, goal_type text, parent_goal_id uuid references public.life_goals(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.life_goals add column if not exists goal_type text;
alter table public.life_goals add column if not exists parent_goal_id uuid references public.life_goals(id) on delete set null;

create table if not exists public.routines(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, frequency_rule text not null default 'daily', active boolean not null default true, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.routine_logs(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 routine_id uuid not null references public.routines(id) on delete cascade, log_date date not null,
 completed boolean not null default false, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(routine_id,log_date)
);
create table if not exists public.checklists(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, linked_type text, linked_id uuid, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.checklist_items(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 checklist_id uuid not null references public.checklists(id) on delete cascade, title text not null, position integer not null default 0,
 completed boolean not null default false, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.bucket_list(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, status text not null default 'open', target_date date, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.menstrual_profiles(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 relationship_id uuid references public.relationships(id) on delete set null, subject_name text not null,
 subject_type text not null default 'self', average_cycle_days integer not null default 28, average_period_days integer not null default 5,
 active boolean not null default true, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.menstrual_records(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 profile_id uuid not null references public.menstrual_profiles(id) on delete cascade, start_date date not null, end_date date,
 cycle_length_days integer, next_period_on date, flow text, symptoms text[] not null default array[]::text[], notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(profile_id,start_date)
);
create or replace function public.calculate_menstrual_next_period() returns trigger language plpgsql as $$
declare cycle_days integer;
begin
 select coalesce(new.cycle_length_days,mp.average_cycle_days,28) into cycle_days from public.menstrual_profiles mp where mp.id=new.profile_id;
 new.cycle_length_days:=greatest(15,least(60,coalesce(cycle_days,28)));
 new.next_period_on:=new.start_date+new.cycle_length_days;
 return new;
end $$;
drop trigger if exists menstrual_records_next_period on public.menstrual_records;
create trigger menstrual_records_next_period before insert or update of start_date,cycle_length_days,profile_id on public.menstrual_records for each row execute function public.calculate_menstrual_next_period();

create table if not exists public.medical_appointments(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null,
 provider text, location text, appointment_at timestamptz not null, status text not null default 'scheduled', notes text,
 reminder_minutes integer[] not null default array[10080,1440], alarm_enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.nutrition_logs(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, log_date date not null,
 meal_type text, calories numeric(8,2), protein_g numeric(7,2), carbs_g numeric(7,2), fat_g numeric(7,2), water_ml integer, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.health_metrics add column if not exists body_temperature_c numeric(4,2);
alter table public.health_metrics add column if not exists oxygen_saturation_pct numeric(5,2);

alter table public.learning_items add column if not exists total_pages integer;
alter table public.learning_items add column if not exists current_page integer not null default 0;
alter table public.learning_items add column if not exists summary text;
alter table public.learning_items add column if not exists completed_on date;
create table if not exists public.learning_notes(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 learning_item_id uuid not null references public.learning_items(id) on delete cascade, section_label text, title text, body text,
 page_from integer, page_to integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.learning_sessions add column if not exists activity_type text not null default 'study';
alter table public.spiritual_entries add column if not exists prophecy text;
alter table public.learning_sessions add column if not exists skill text;
alter table public.learning_sessions add column if not exists words_learned integer not null default 0;
alter table public.learning_sessions add column if not exists resource_url text;
create table if not exists public.language_profiles(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 language_code text not null, language_name text not null, level text not null default 'A1', target_level text,
 focus_areas text[] not null default array[]::text[], active boolean not null default true, target_date date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,language_code)
);

create table if not exists public.relationship_interactions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 relationship_id uuid not null references public.relationships(id) on delete cascade, interaction_on date not null,
 interaction_type text not null default 'contact', notes text, follow_up_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.work_sessions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 work_item_id uuid references public.work_items(id) on delete set null, session_date date not null, minutes integer not null default 0, notes text,
 created_at timestamptz not null default now()
);

create table if not exists public.finance_budgets(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null,
 category_id uuid references public.finance_categories(id) on delete set null, amount numeric(14,2) not null default 0, period text not null default 'monthly',
 start_on date not null, end_on date, active boolean not null default true, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.finance_debts(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, debt_type text,
 principal numeric(14,2) not null default 0, balance numeric(14,2) not null default 0, interest_rate numeric(7,3), due_on date,
 minimum_payment numeric(14,2), status text not null default 'open', notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.finance_savings_goals(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null,
 target_amount numeric(14,2) not null default 0, current_amount numeric(14,2) not null default 0, target_date date, status text not null default 'active',
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.finance_investments(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null,
 asset_type text, invested_amount numeric(14,2) not null default 0, current_value numeric(14,2) not null default 0, acquired_on date,
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.finance_external_sources(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, source_key text not null,
 name text not null, active boolean not null default true, endpoint_url text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,source_key)
);
create table if not exists public.finance_external_snapshots(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source_id uuid not null references public.finance_external_sources(id) on delete cascade, period_start date not null, period_end date not null,
 income numeric(14,2) not null default 0, expense numeric(14,2) not null default 0, raw_payload jsonb not null default '{}'::jsonb,
 received_at timestamptz not null default now(), unique(source_id,period_start,period_end)
);

create table if not exists public.life_events(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null, event_type text not null, entity_type text, entity_id uuid, event_at timestamptz not null default now(),
 payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(user_id,event_key)
);
create table if not exists public.notification_jobs(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, source_type text not null, source_id uuid,
 fire_at timestamptz not null, title text not null, body text, payload jsonb not null default '{}'::jsonb, status text not null default 'pending',
 sent_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notification_jobs_due_idx on public.notification_jobs(status,fire_at);
create table if not exists public.push_subscriptions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, endpoint text not null,
 subscription jsonb not null, expiration_time timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,endpoint)
);
create table if not exists public.ai_runs(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, run_at timestamptz not null default now(),
 kind text not null, prompt text, snapshot jsonb not null default '{}'::jsonb, response text, score numeric(5,2), created_at timestamptz not null default now()
);
alter table public.gamification_achievements add column if not exists unlocked_at timestamptz;
alter table public.gamification_challenges add column if not exists reward_xp integer not null default 0;

do $$
declare t text;
begin
 foreach t in array array['life_goals','routines','routine_logs','checklists','checklist_items','bucket_list','menstrual_profiles','menstrual_records','medical_appointments','nutrition_logs','learning_notes','language_profiles','learning_sessions','relationship_interactions','work_sessions','finance_budgets','finance_debts','finance_savings_goals','finance_investments','finance_external_sources','finance_external_snapshots','life_events','notification_jobs','push_subscriptions','ai_runs','gamification_achievements','gamification_challenges'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on table public.%I from anon',t);
   execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
   execute format('drop policy if exists %I_all_own on public.%I',t,t);
   execute format('create policy %I_all_own on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t,t);
   if t <> 'life_events' and t <> 'notification_jobs' and t <> 'work_sessions' and t <> 'gamification_achievements' then
     execute format('drop trigger if exists %I_updated_at on public.%I',t,t);
     execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
   end if;
 end loop;
end $$;

create index if not exists menstrual_records_profile_date_idx on public.menstrual_records(profile_id,start_date desc);
create index if not exists relationship_interactions_rel_date_idx on public.relationship_interactions(relationship_id,interaction_on desc);
create index if not exists learning_notes_item_idx on public.learning_notes(learning_item_id,page_from);
create index if not exists work_sessions_user_date_idx on public.work_sessions(user_id,session_date);
create index if not exists finance_external_snapshots_source_period_idx on public.finance_external_snapshots(source_id,period_start,period_end);

create or replace function public.refresh_relationship_notification_trigger()
returns trigger language plpgsql as $$
declare r record; y integer; b date;
begin
 select * into r from public.relationships where id=new.id and user_id=new.user_id;
 if not found then return new; end if;
 delete from public.notification_jobs where user_id=new.user_id and source_type='relationship' and source_id=new.id and status='pending';
 y:=extract(year from current_date)::integer;
 if r.birthday is not null then
   b:=make_date(y,extract(month from r.birthday)::integer,extract(day from r.birthday)::integer);
   if b-7<current_date then b:=make_date(y+1,extract(month from r.birthday)::integer,extract(day from r.birthday)::integer); end if;
   insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
   values(new.user_id,'relationship',new.id,(b-7)::timestamptz,'Cumpleaños de '||r.name,'Cumpleaños de '||r.name||' en una semana.',jsonb_build_object('kind','birthday','event_on',b));
 end if;
 if r.anniversary is not null then
   b:=make_date(y,extract(month from r.anniversary)::integer,extract(day from r.anniversary)::integer);
   if b-7<current_date then b:=make_date(y+1,extract(month from r.anniversary)::integer,extract(day from r.anniversary)::integer); end if;
   insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
   values(new.user_id,'relationship',new.id,(b-7)::timestamptz,'Aniversario de '||r.name,'Aniversario de '||r.name||' en una semana.',jsonb_build_object('kind','anniversary','event_on',b));
 end if;
 return new;
end $$;

create or replace function public.refresh_medical_notification_trigger()
returns trigger language plpgsql as $$
declare a record; mins integer; fire timestamptz;
begin
 select * into a from public.medical_appointments where id=new.id and user_id=new.user_id;
 if not found then return new; end if;
 delete from public.notification_jobs where user_id=new.user_id and source_type='medical_appointment' and source_id=new.id and status='pending';
 if not a.alarm_enabled then return new; end if;
 foreach mins in array a.reminder_minutes loop
   fire:=a.appointment_at-make_interval(mins=>mins);
   if fire>now() then
     insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
     values(new.user_id,'medical_appointment',new.id,fire,'Cita médica: '||a.title,coalesce(a.notes,'Recordatorio de tu cita médica.'),jsonb_build_object('appointment_id',new.id));
   end if;
 end loop;
 return new;
end $$;

drop trigger if exists relationships_refresh_notifications on public.relationships;
create trigger relationships_refresh_notifications after insert or update of birthday,anniversary,name on public.relationships for each row execute function public.refresh_relationship_notification_trigger();
drop trigger if exists medical_refresh_notifications on public.medical_appointments;
create trigger medical_refresh_notifications after insert or update on public.medical_appointments for each row execute function public.refresh_medical_notification_trigger();
