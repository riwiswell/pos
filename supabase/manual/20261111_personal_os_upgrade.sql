-- Personal OS: SQL de actualización para la base de datos ACTIVA de POS.
-- Ejecutar una sola vez en el SQL Editor del proyecto que actualmente usa POS.
-- No ejecutar en el nuevo proyecto zavxenmtlxmykkcoordr mientras POS siga conectado a eutrhjvdyrakrxmjemut.
-- Las instrucciones son idempotentes en cuanto a columnas, tablas, índices y políticas.

-- ===== supabase/migrations/20261110190000_life_event_update_timestamps.sql =====
-- Health metric edits should appear in the Life timeline without awarding XP again.
-- Preserve the action-integrity rules for habits, routines, and work sessions.
create or replace function public.emit_life_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
  key text;
  habit_kind text;
  event_exists boolean;
  occurred_at timestamptz;
begin
  payload := to_jsonb(new) || jsonb_build_object('_operation', tg_op);

  if tg_table_name = 'habit_logs' then
    select h.kind
      into habit_kind
      from public.habits h
     where h.id = new.habit_id
       and h.user_id = new.user_id;

    payload := payload || jsonb_build_object('habit_kind', coalesce(habit_kind, 'habit'));

    if coalesce((payload->>'completed')::boolean, false) = false
       and coalesce(nullif(payload->>'value','')::numeric,0) <= 0 then
      return new;
    end if;

    select exists (
      select 1
        from public.life_events le
        join public.gamification_xp_events xp on xp.life_event_id = le.id
       where le.user_id = new.user_id
         and le.entity_type = 'habit_logs'
         and le.entity_id = new.id
         and xp.xp > 0
    ) into event_exists;
    if event_exists then
      return new;
    end if;

    key := 'habit_logs:' || new.id::text || ':progress';

  elsif tg_table_name = 'routine_logs' then
    if coalesce((payload->>'completed')::boolean, false) = false then
      return new;
    end if;

    select exists (
      select 1
        from public.life_events le
        join public.gamification_xp_events xp on xp.life_event_id = le.id
       where le.user_id = new.user_id
         and le.entity_type = 'routine_logs'
         and le.entity_id = new.id
         and xp.xp > 0
    ) into event_exists;
    if event_exists then
      return new;
    end if;

    key := 'routine_logs:' || new.id::text || ':completed';

  elsif tg_table_name = 'work_sessions'
        and coalesce(payload->>'status','') = 'completed' then
    select exists (
      select 1
        from public.life_events le
        join public.gamification_xp_events xp on xp.life_event_id = le.id
       where le.user_id = new.user_id
         and le.entity_type = 'work_sessions'
         and le.entity_id = new.id
         and xp.xp > 0
    ) into event_exists;
    if event_exists then
      return new;
    end if;

    key := 'work_sessions:' || new.id::text || ':completed';

  elsif tg_table_name = 'health_metrics' and tg_op = 'UPDATE' then
    occurred_at := clock_timestamp();
    key := 'health_metrics:' || new.id::text || ':update:' ||
      to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

  elsif tg_op = 'UPDATE' then
    -- General edits remain out of the event stream and never award XP.
    return new;

  else
    key := tg_table_name || ':' || new.id::text;
  end if;

  if occurred_at is null then
    occurred_at := coalesce(
      nullif(payload->>'created_at', '')::timestamptz,
      now()
    );
  end if;

  insert into public.life_events(
    user_id, event_key, event_type, entity_type, entity_id, event_at, payload
  )
  values(
    new.user_id,
    key,
    case when tg_op = 'INSERT' then 'recorded' else 'updated' end,
    tg_table_name,
    new.id,
    occurred_at,
    payload
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end
$$;

-- ===== supabase/migrations/20261110210000_medication_stock_hydration_and_external_finance.sql =====
-- Inventory-aware medication records and a single source for fluid intake.
-- Existing medication rows remain valid; new stock fields are independent from
-- the strength/dose unit (for example, 50 mg strength vs 30 tablets in the box).

alter table public.medications
  add column if not exists stock_unit text not null default 'unidad',
  add column if not exists units_per_dose numeric(10,3) not null default 1;

alter table public.medications
  drop constraint if exists medications_units_per_dose_check;
alter table public.medications
  add constraint medications_units_per_dose_check
  check (units_per_dose > 0);

create table if not exists public.medication_stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  movement_type text not null default 'restock' check (movement_type in ('restock','adjustment')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists medication_stock_movements_user_med_idx
  on public.medication_stock_movements(user_id, medication_id, created_at desc);

alter table public.medication_stock_movements enable row level security;
revoke all on table public.medication_stock_movements from anon;
grant select, insert on table public.medication_stock_movements to authenticated;
drop policy if exists medication_stock_movements_select_own on public.medication_stock_movements;
drop policy if exists medication_stock_movements_insert_own on public.medication_stock_movements;
create policy medication_stock_movements_select_own on public.medication_stock_movements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy medication_stock_movements_insert_own on public.medication_stock_movements
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.medications medication
      where medication.id = medication_id and medication.user_id = (select auth.uid())
    )
  );

create table if not exists public.hydration_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_on date not null default current_date,
  consumed_at timestamptz not null default now(),
  beverage_type text not null check (beverage_type in ('water','coffee','tea','milk','other')),
  amount_ml integer not null check (amount_ml between 1 and 5000),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists hydration_entries_user_day_idx
  on public.hydration_entries(user_id, consumed_on, consumed_at);

alter table public.hydration_entries enable row level security;
revoke all on table public.hydration_entries from anon;
grant select, insert, update, delete on table public.hydration_entries to authenticated;
drop policy if exists hydration_entries_select_own on public.hydration_entries;
drop policy if exists hydration_entries_insert_own on public.hydration_entries;
drop policy if exists hydration_entries_update_own on public.hydration_entries;
drop policy if exists hydration_entries_delete_own on public.hydration_entries;
create policy hydration_entries_select_own on public.hydration_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy hydration_entries_insert_own on public.hydration_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy hydration_entries_update_own on public.hydration_entries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy hydration_entries_delete_own on public.hydration_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Stable import keys let a trusted external sales integration be retried safely.
alter table public.finance_transactions
  add column if not exists external_source text,
  add column if not exists external_id text;

create unique index if not exists finance_transactions_external_unique
  on public.finance_transactions(user_id, external_source, external_id)
  where external_source is not null and external_id is not null;

-- ===== supabase/migrations/20261111100000_shared_habits_goals_and_icons.sql =====
-- Personal OS: icon support and opt-in shared spaces for habits, activities and goals.
-- Append-only. Shared records are isolated from private habits and individual XP.

alter table public.habits add column if not exists icon text;

create table if not exists public.personal_shared_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_shared_space_members (
  space_id uuid not null references public.personal_shared_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (space_id,user_id)
);

create table if not exists public.personal_shared_space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.personal_shared_spaces(id) on delete cascade,
  invited_email text not null check (position('@' in invited_email)>1),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invite_code uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default now()+interval '30 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists personal_shared_space_invites_pending_email_uidx
  on public.personal_shared_space_invites(space_id,lower(invited_email))
  where status='pending';
create index if not exists personal_shared_space_invites_email_idx
  on public.personal_shared_space_invites(lower(invited_email),status);

create table if not exists public.personal_shared_habits (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.personal_shared_spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  icon text,
  kind text not null default 'habit' check (kind in ('habit','activity')),
  tracking_type text not null default 'check' check (tracking_type in ('check','counter')),
  target numeric(10,2),
  unit text,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target is null or target>0)
);
create index if not exists personal_shared_habits_space_idx
  on public.personal_shared_habits(space_id,active,position);

create table if not exists public.personal_shared_habit_logs (
  id uuid primary key default gen_random_uuid(),
  shared_habit_id uuid not null references public.personal_shared_habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  completed boolean not null default false,
  value numeric(10,2) not null default 0 check (value>=0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shared_habit_id,user_id,log_date)
);
create index if not exists personal_shared_habit_logs_member_date_idx
  on public.personal_shared_habit_logs(user_id,log_date desc);

create table if not exists public.personal_shared_goals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.personal_shared_spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 150),
  description text,
  icon text,
  goal_type text not null default 'goal' check (goal_type in ('goal','challenge')),
  target numeric(12,2) not null check (target>0),
  progress numeric(12,2) not null default 0 check (progress>=0),
  unit text,
  reward_points integer not null default 0 check (reward_points>=0),
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active' check (status in ('active','completed','paused','archived')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on>=starts_on)
);
create index if not exists personal_shared_goals_space_idx
  on public.personal_shared_goals(space_id,status,ends_on);

create table if not exists public.personal_shared_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.personal_shared_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount>0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists personal_shared_goal_contributions_goal_idx
  on public.personal_shared_goal_contributions(goal_id,created_at);

create table if not exists public.personal_shared_points_ledger (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.personal_shared_spaces(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  points integer not null check (points>0),
  reason text not null,
  created_at timestamptz not null default now(),
  unique(space_id,source_type,source_id)
);
create index if not exists personal_shared_points_space_idx
  on public.personal_shared_points_ledger(space_id,created_at desc);

create or replace function public.personal_shared_is_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1 from public.personal_shared_space_members m
    where m.space_id=p_space_id and m.user_id=auth.uid()
  );
$$;

create or replace function public.personal_shared_is_owner(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1 from public.personal_shared_space_members m
    where m.space_id=p_space_id and m.user_id=auth.uid() and m.role='owner'
  );
$$;

revoke all on function public.personal_shared_is_member(uuid) from public;
revoke all on function public.personal_shared_is_owner(uuid) from public;
grant execute on function public.personal_shared_is_member(uuid) to authenticated;
grant execute on function public.personal_shared_is_owner(uuid) to authenticated;

create or replace function public.personal_shared_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.personal_shared_space_members(space_id,user_id,role)
  values(new.id,new.owner_id,'owner')
  on conflict(space_id,user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists personal_shared_add_owner_member on public.personal_shared_spaces;
create trigger personal_shared_add_owner_member
after insert on public.personal_shared_spaces
for each row execute function public.personal_shared_add_owner_member();

create or replace function public.accept_personal_shared_invite(p_invite_code uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  invite_row public.personal_shared_space_invites%rowtype;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para aceptar esta invitación.';
  end if;
  current_email:=lower(coalesce(auth.jwt()->>'email',''));
  if current_email='' then
    raise exception 'No se pudo verificar el correo de tu cuenta.';
  end if;
  select * into invite_row
  from public.personal_shared_space_invites
  where invite_code=p_invite_code
  for update;
  if not found then
    raise exception 'La invitación no existe o el código no es válido.';
  end if;
  if invite_row.status<>'pending' or invite_row.expires_at<=now() then
    raise exception 'La invitación ya no está disponible.';
  end if;
  if lower(invite_row.invited_email)<>current_email then
    raise exception 'Inicia sesión con el correo al que fue enviada la invitación.';
  end if;
  insert into public.personal_shared_space_members(space_id,user_id,role)
  values(invite_row.space_id,auth.uid(),'member')
  on conflict(space_id,user_id) do nothing;
  update public.personal_shared_space_invites
  set status='accepted',accepted_by=auth.uid(),accepted_at=now()
  where id=invite_row.id;
  return invite_row.space_id;
end;
$$;
revoke all on function public.accept_personal_shared_invite(uuid) from public;
grant execute on function public.accept_personal_shared_invite(uuid) to authenticated;

create or replace function public.personal_shared_apply_goal_contribution()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  goal_space_id uuid;
  goal_points integer;
  goal_status text;
begin
  update public.personal_shared_goals g
  set progress=least(g.target,g.progress+new.amount),
      status=case when g.progress+new.amount>=g.target then 'completed' else g.status end,
      completed_at=case when g.progress+new.amount>=g.target then coalesce(g.completed_at,now()) else g.completed_at end,
      updated_at=now()
  where g.id=new.goal_id and g.status='active'
  returning g.space_id,g.reward_points,g.status
  into goal_space_id,goal_points,goal_status;

  if found and goal_status='completed' and goal_points>0 then
    insert into public.personal_shared_points_ledger(space_id,source_type,source_id,points,reason)
    values(goal_space_id,'goal_completed',new.goal_id,goal_points,'Reto o meta compartida completada')
    on conflict(space_id,source_type,source_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists personal_shared_goal_contribution on public.personal_shared_goal_contributions;
create trigger personal_shared_goal_contribution
after insert on public.personal_shared_goal_contributions
for each row execute function public.personal_shared_apply_goal_contribution();

-- These functions are trigger-only entry points. Trigger execution does not
-- require callers to have direct EXECUTE privileges on the trigger function.
revoke all on function public.personal_shared_add_owner_member() from public, anon, authenticated;
revoke all on function public.personal_shared_apply_goal_contribution() from public, anon, authenticated;

alter table public.personal_shared_spaces enable row level security;
alter table public.personal_shared_space_members enable row level security;
alter table public.personal_shared_space_invites enable row level security;
alter table public.personal_shared_habits enable row level security;
alter table public.personal_shared_habit_logs enable row level security;
alter table public.personal_shared_goals enable row level security;
alter table public.personal_shared_goal_contributions enable row level security;
alter table public.personal_shared_points_ledger enable row level security;

revoke all on public.personal_shared_spaces,public.personal_shared_space_members,public.personal_shared_space_invites,
  public.personal_shared_habits,public.personal_shared_habit_logs,public.personal_shared_goals,
  public.personal_shared_goal_contributions,public.personal_shared_points_ledger from anon;

grant select,insert,update,delete on public.personal_shared_spaces to authenticated;
grant select,delete on public.personal_shared_space_members to authenticated;
grant select,insert,update,delete on public.personal_shared_space_invites to authenticated;
grant select,insert,update,delete on public.personal_shared_habits to authenticated;
grant select,insert,update,delete on public.personal_shared_habit_logs to authenticated;
revoke update,delete on table public.personal_shared_goals from public, anon, authenticated;
grant select,insert on public.personal_shared_goals to authenticated;
grant select,insert on public.personal_shared_goal_contributions to authenticated;
grant select on public.personal_shared_points_ledger to authenticated;

drop policy if exists personal_shared_spaces_select on public.personal_shared_spaces;
create policy personal_shared_spaces_select on public.personal_shared_spaces
for select to authenticated using (public.personal_shared_is_member(id));
drop policy if exists personal_shared_spaces_insert on public.personal_shared_spaces;
create policy personal_shared_spaces_insert on public.personal_shared_spaces
for insert to authenticated with check (owner_id=auth.uid());
drop policy if exists personal_shared_spaces_update on public.personal_shared_spaces;
create policy personal_shared_spaces_update on public.personal_shared_spaces
for update to authenticated using (public.personal_shared_is_owner(id))
with check (public.personal_shared_is_owner(id) and owner_id=auth.uid());
drop policy if exists personal_shared_spaces_delete on public.personal_shared_spaces;
create policy personal_shared_spaces_delete on public.personal_shared_spaces
for delete to authenticated using (public.personal_shared_is_owner(id));

drop policy if exists personal_shared_members_select on public.personal_shared_space_members;
create policy personal_shared_members_select on public.personal_shared_space_members
for select to authenticated using (public.personal_shared_is_member(space_id));
drop policy if exists personal_shared_members_leave on public.personal_shared_space_members;
create policy personal_shared_members_leave on public.personal_shared_space_members
for delete to authenticated using (user_id=auth.uid() and role='member');

drop policy if exists personal_shared_invites_select on public.personal_shared_space_invites;
create policy personal_shared_invites_select on public.personal_shared_space_invites
for select to authenticated using (
  lower(invited_email)=lower(coalesce(auth.jwt()->>'email',''))
  or public.personal_shared_is_member(space_id)
);
drop policy if exists personal_shared_invites_insert on public.personal_shared_space_invites;
create policy personal_shared_invites_insert on public.personal_shared_space_invites
for insert to authenticated with check (
  invited_by=auth.uid()
  and status='pending'
  and public.personal_shared_is_owner(space_id)
);
drop policy if exists personal_shared_invites_update on public.personal_shared_space_invites;
create policy personal_shared_invites_update on public.personal_shared_space_invites
for update to authenticated using (public.personal_shared_is_owner(space_id))
with check (public.personal_shared_is_owner(space_id));
drop policy if exists personal_shared_invites_delete on public.personal_shared_space_invites;
create policy personal_shared_invites_delete on public.personal_shared_space_invites
for delete to authenticated using (public.personal_shared_is_owner(space_id));

drop policy if exists personal_shared_habits_select on public.personal_shared_habits;
create policy personal_shared_habits_select on public.personal_shared_habits
for select to authenticated using (public.personal_shared_is_member(space_id));
drop policy if exists personal_shared_habits_insert on public.personal_shared_habits;
create policy personal_shared_habits_insert on public.personal_shared_habits
for insert to authenticated with check (created_by=auth.uid() and public.personal_shared_is_member(space_id));
drop policy if exists personal_shared_habits_update on public.personal_shared_habits;
create policy personal_shared_habits_update on public.personal_shared_habits
for update to authenticated
using (public.personal_shared_is_owner(space_id) or created_by=auth.uid())
with check (
  public.personal_shared_is_member(space_id)
  and (public.personal_shared_is_owner(space_id) or created_by=auth.uid())
);
drop policy if exists personal_shared_habits_delete on public.personal_shared_habits;
create policy personal_shared_habits_delete on public.personal_shared_habits
for delete to authenticated using (public.personal_shared_is_owner(space_id) or created_by=auth.uid());

drop policy if exists personal_shared_habit_logs_select on public.personal_shared_habit_logs;
create policy personal_shared_habit_logs_select on public.personal_shared_habit_logs
for select to authenticated using (
  exists(select 1 from public.personal_shared_habits h where h.id=shared_habit_id and public.personal_shared_is_member(h.space_id))
);
drop policy if exists personal_shared_habit_logs_insert on public.personal_shared_habit_logs;
create policy personal_shared_habit_logs_insert on public.personal_shared_habit_logs
for insert to authenticated with check (
  user_id=auth.uid()
  and exists(select 1 from public.personal_shared_habits h where h.id=shared_habit_id and public.personal_shared_is_member(h.space_id))
);
drop policy if exists personal_shared_habit_logs_update on public.personal_shared_habit_logs;
create policy personal_shared_habit_logs_update on public.personal_shared_habit_logs
for update to authenticated using (user_id=auth.uid())
with check (
  user_id=auth.uid()
  and exists(select 1 from public.personal_shared_habits h where h.id=shared_habit_id and public.personal_shared_is_member(h.space_id))
);
drop policy if exists personal_shared_habit_logs_delete on public.personal_shared_habit_logs;
create policy personal_shared_habit_logs_delete on public.personal_shared_habit_logs
for delete to authenticated using (user_id=auth.uid());

drop policy if exists personal_shared_goals_select on public.personal_shared_goals;
create policy personal_shared_goals_select on public.personal_shared_goals
for select to authenticated using (public.personal_shared_is_member(space_id));
drop policy if exists personal_shared_goals_insert on public.personal_shared_goals;
create policy personal_shared_goals_insert on public.personal_shared_goals
for insert to authenticated with check (created_by=auth.uid() and public.personal_shared_is_member(space_id));
drop policy if exists personal_shared_goals_update on public.personal_shared_goals;

drop policy if exists personal_shared_goal_contributions_select on public.personal_shared_goal_contributions;
create policy personal_shared_goal_contributions_select on public.personal_shared_goal_contributions
for select to authenticated using (
  exists(select 1 from public.personal_shared_goals g where g.id=goal_id and public.personal_shared_is_member(g.space_id))
);
drop policy if exists personal_shared_goal_contributions_insert on public.personal_shared_goal_contributions;
create policy personal_shared_goal_contributions_insert on public.personal_shared_goal_contributions
for insert to authenticated with check (
  user_id=auth.uid()
  and exists(select 1 from public.personal_shared_goals g where g.id=goal_id and public.personal_shared_is_member(g.space_id))
);

drop policy if exists personal_shared_points_select on public.personal_shared_points_ledger;
create policy personal_shared_points_select on public.personal_shared_points_ledger
for select to authenticated using (public.personal_shared_is_member(space_id));

-- ===== supabase/migrations/20261111120000_learning_book_target_pages.sql =====
-- Separate a book's full length from an optional intermediate page goal.
alter table public.learning_items
  add column if not exists target_pages integer;

alter table public.learning_items
  drop constraint if exists learning_items_target_pages_check;
alter table public.learning_items
  add constraint learning_items_target_pages_check
  check (target_pages is null or target_pages > 0);

-- Correct Ricardo's imported copy: 1,022 pages is the actual book length;
-- 712 pages remains his intermediate target, not the book's end.
update public.learning_items li
set total_pages = 1022,
    target_pages = 712,
    updated_at = now()
where li.kind = 'book'
  and lower(trim(li.title)) = lower('La historia del arte')
  and li.user_id = (
    select u.id from auth.users u
    where lower(u.email) = lower('riwiswell@gmail.com')
    limit 1
  );


-- Correct the imported reading length for the completed Viktor Frankl book.
-- Its 129-page physical edition includes pages outside the 111-page reading content.
update public.learning_items li
set total_pages = 111,
    current_page = least(coalesce(li.current_page,111),111),
    progress = case
      when coalesce(li.current_page,111) >= 111 then 100
      else round((coalesce(li.current_page,0)::numeric / 111) * 100, 2)
    end,
    completed_on = case
      when coalesce(li.current_page,111) >= 111 then coalesce(li.completed_on,current_date)
      else li.completed_on
    end,
    updated_at = now()
where li.kind = 'book'
  and lower(trim(li.title)) like '%el hombre en busca de sentido%'
  and li.user_id = (
    select u.id from auth.users u
    where lower(u.email) = lower('riwiswell@gmail.com')
    limit 1
  );

-- ===== supabase/migrations/20261111150000_learning_item_cover_path.sql =====
-- Optional private Storage object path for the cover image of a learning item.
-- Images are kept in the existing private finance-photos bucket under the owner's UUID folder.
alter table public.learning_items
  add column if not exists cover_path text;

-- ===== supabase/migrations/20261111160000_learning_game_goals.sql =====
-- Optional goals for video games in the learning library.
alter table public.learning_items
  add column if not exists goal_description text,
  add column if not exists goal_date date;

alter table public.learning_items
  drop constraint if exists learning_items_goal_description_check;
alter table public.learning_items
  add constraint learning_items_goal_description_check
  check (goal_description is null or length(goal_description) <= 240);

