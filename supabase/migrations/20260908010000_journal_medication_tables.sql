-- Core user data tables consumed by Diario and Salud.
-- These tables exist in the hosted schema, but need to be part of a reproducible clean install.
create extension if not exists pgcrypto;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text,
  content text not null default '',
  entry_date date not null default current_date,
  entry_time time,
  mood text,
  notes text,
  items text[] not null default array[]::text[],
  photos text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_entries_user_date_idx
  on public.journal_entries(user_id, entry_date desc, entry_time desc, created_at desc);

alter table public.journal_entries enable row level security;
revoke all on table public.journal_entries from anon;
grant select, insert, update, delete on table public.journal_entries to authenticated;
drop policy if exists journal_entries_select on public.journal_entries;
drop policy if exists journal_entries_insert on public.journal_entries;
drop policy if exists journal_entries_update on public.journal_entries;
drop policy if exists journal_entries_delete on public.journal_entries;
create policy journal_entries_select on public.journal_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy journal_entries_insert on public.journal_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy journal_entries_update on public.journal_entries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy journal_entries_delete on public.journal_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dose numeric(10,3),
  unit text,
  frequency text not null default 'daily',
  times text[] not null default array[]::text[],
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  notes text,
  remind_offset_min integer not null default 0,
  total_quantity numeric(12,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medications_user_active_name_idx
  on public.medications(user_id, active desc, name);

alter table public.medications enable row level security;
revoke all on table public.medications from anon;
grant select, insert, update, delete on table public.medications to authenticated;
drop policy if exists medications_select on public.medications;
drop policy if exists medications_insert on public.medications;
drop policy if exists medications_update on public.medications;
drop policy if exists medications_delete on public.medications;
create policy medications_select on public.medications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy medications_insert on public.medications
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy medications_update on public.medications
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy medications_delete on public.medications
  for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  dose_date date not null,
  scheduled_time text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  taken_at timestamptz,
  snoozed_until timestamptz,
  water_glasses numeric(4,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_doses_status_check check (status in ('pending','taken','skipped','snoozed')),
  constraint medication_doses_medication_id_dose_date_scheduled_time_key
    unique (medication_id, dose_date, scheduled_time)
);

create index if not exists medication_doses_user_date_idx
  on public.medication_doses(user_id, dose_date desc, scheduled_at desc);
create index if not exists medication_doses_medication_status_idx
  on public.medication_doses(medication_id, status, scheduled_at);

alter table public.medication_doses enable row level security;
revoke all on table public.medication_doses from anon;
grant select, insert, update, delete on table public.medication_doses to authenticated;
drop policy if exists medication_doses_select on public.medication_doses;
drop policy if exists medication_doses_insert on public.medication_doses;
drop policy if exists medication_doses_update on public.medication_doses;
drop policy if exists medication_doses_delete on public.medication_doses;
create policy medication_doses_select on public.medication_doses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy medication_doses_insert on public.medication_doses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy medication_doses_update on public.medication_doses
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy medication_doses_delete on public.medication_doses
  for delete to authenticated using ((select auth.uid()) = user_id);
