-- Personal OS: optional private bowel movement tracking in Salud.
-- Each user may record only the entries they choose to keep.

create table if not exists public.health_bowel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default (now() at time zone 'America/Bogota')::date,
  log_time time not null default (now() at time zone 'America/Bogota')::time,
  logged_at timestamptz not null default now(),
  bristol_type smallint,
  symptoms text[] not null default array[]::text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_bowel_logs_bristol_type_check
    check (bristol_type is null or bristol_type between 1 and 7),
  constraint health_bowel_logs_symptoms_check
    check (symptoms <@ array['effort','pain','blood','urgency','incomplete']::text[]),
  constraint health_bowel_logs_notes_length_check
    check (notes is null or length(notes) <= 2000)
);

create index if not exists health_bowel_logs_user_date_idx
  on public.health_bowel_logs(user_id, log_date desc, log_time desc, created_at desc);

create or replace function public.validate_health_bowel_log()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.log_date > (now() at time zone 'America/Bogota')::date then
    raise exception 'No puedes registrar una fecha futura.';
  end if;
  return new;
end
$$;

drop trigger if exists health_bowel_logs_validate on public.health_bowel_logs;
create trigger health_bowel_logs_validate
  before insert or update of user_id, log_date
  on public.health_bowel_logs
  for each row execute function public.validate_health_bowel_log();

drop trigger if exists health_bowel_logs_updated_at on public.health_bowel_logs;
create trigger health_bowel_logs_updated_at
  before update on public.health_bowel_logs
  for each row execute function public.set_updated_at();

alter table public.health_bowel_logs enable row level security;
revoke all on table public.health_bowel_logs from anon;
grant select, insert, update, delete on table public.health_bowel_logs to authenticated;

drop policy if exists health_bowel_logs_select_own on public.health_bowel_logs;
drop policy if exists health_bowel_logs_insert_own on public.health_bowel_logs;
drop policy if exists health_bowel_logs_update_own on public.health_bowel_logs;
drop policy if exists health_bowel_logs_delete_own on public.health_bowel_logs;

create policy health_bowel_logs_select_own on public.health_bowel_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy health_bowel_logs_insert_own on public.health_bowel_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy health_bowel_logs_update_own on public.health_bowel_logs
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy health_bowel_logs_delete_own on public.health_bowel_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.health_bowel_logs is
  'Optional private user-entered record of bowel movements, consistency, symptoms and notes.';
