-- Personal OS: relationships, spirituality and automatic gamification completion.
-- Append-only migration. Never edit prior migrations.

-- RELATIONSHIPS -------------------------------------------------------------

alter table public.relationships
  add column if not exists contact_frequency_days integer,
  add column if not exists next_contact_on date;

create index if not exists relationships_followup_idx
  on public.relationships(user_id, next_contact_on);

create index if not exists relationships_birthday_idx
  on public.relationships(user_id, birthday);

create index if not exists relationships_anniversary_idx
  on public.relationships(user_id, anniversary);

create or replace function public.sync_relationship_interaction()
returns trigger
language plpgsql
as $$
begin
  update public.relationships
     set last_contact_on = greatest(coalesce(last_contact_on, new.interaction_on), new.interaction_on),
         next_contact_on = case
           when contact_frequency_days is not null and contact_frequency_days > 0
             then new.interaction_on + contact_frequency_days
           else next_contact_on
         end,
         updated_at = now()
   where id = new.relationship_id
     and user_id = new.user_id;

  return new;
end
$$;

drop trigger if exists sync_relationship_interaction on public.relationship_interactions;
create trigger sync_relationship_interaction
after insert on public.relationship_interactions
for each row execute function public.sync_relationship_interaction();

-- Rebuild the relationship reminder trigger so birthdays, anniversaries and
-- follow-up dates are all represented by persistent notification jobs.
create or replace function public.refresh_relationship_notification_trigger()
returns trigger
language plpgsql
as $$
declare
  y integer;
  b date;
  fire_at timestamptz;
begin
  delete from public.notification_jobs
   where user_id = new.user_id
     and source_type = 'relationship'
     and source_id = new.id
     and status = 'pending';

  y := extract(year from current_date)::integer;

  if new.birthday is not null then
    b := make_date(y, extract(month from new.birthday)::integer, extract(day from new.birthday)::integer);
    if b < current_date then
      b := make_date(y + 1, extract(month from new.birthday)::integer, extract(day from new.birthday)::integer);
    end if;
    fire_at := (b - 7)::timestamptz;
    if fire_at > now() then
      insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
      values (
        new.user_id,'relationship',new.id,fire_at,
        'Cumpleaños de ' || new.name,
        'Cumpleaños de ' || new.name || ' en una semana.',
        jsonb_build_object('kind','birthday','event_on',b)
      );
    end if;
  end if;

  if new.anniversary is not null then
    b := make_date(y, extract(month from new.anniversary)::integer, extract(day from new.anniversary)::integer);
    if b < current_date then
      b := make_date(y + 1, extract(month from new.anniversary)::integer, extract(day from new.anniversary)::integer);
    end if;
    fire_at := (b - 7)::timestamptz;
    if fire_at > now() then
      insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
      values (
        new.user_id,'relationship',new.id,fire_at,
        'Aniversario de ' || new.name,
        'Aniversario de ' || new.name || ' en una semana.',
        jsonb_build_object('kind','anniversary','event_on',b)
      );
    end if;
  end if;

  if new.next_contact_on is not null then
    fire_at := (new.next_contact_on)::timestamptz;
    if fire_at > now() then
      insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
      values (
        new.user_id,'relationship',new.id,fire_at,
        'Seguimiento: ' || new.name,
        'Hoy tienes previsto cuidar esta relación.',
        jsonb_build_object('kind','relationship_follow_up','event_on',new.next_contact_on)
      );
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists relationships_refresh_notifications on public.relationships;
create trigger relationships_refresh_notifications
after insert or update of birthday,anniversary,name,next_contact_on,contact_frequency_days
on public.relationships
for each row execute function public.refresh_relationship_notification_trigger();

-- SPIRITUALITY ---------------------------------------------------------------

alter table public.spiritual_entries
  add column if not exists scripture_reference text,
  add column if not exists answered_note text;

create table if not exists public.spiritual_goals(
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

alter table public.spiritual_entries enable row level security;
revoke all on table public.spiritual_entries from anon;
grant select,insert,update,delete on table public.spiritual_entries to authenticated;
drop policy if exists spiritual_entries_all_own on public.spiritual_entries;
create policy spiritual_entries_all_own on public.spiritual_entries
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

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

create index if not exists spiritual_entries_user_date_idx
  on public.spiritual_entries(user_id, entry_date desc);

create index if not exists spiritual_goals_user_status_idx
  on public.spiritual_goals(user_id,status);

-- GAMIFICATION ---------------------------------------------------------------

create table if not exists public.gamification_xp_events(
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

alter table public.gamification_challenges
  add column if not exists code text,
  add column if not exists kind text not null default 'events';

create index if not exists gamification_challenges_active_idx
  on public.gamification_challenges(user_id,status,starts_on,ends_on);

-- Existing rows may have no code; new/default rows use deterministic codes.
create unique index if not exists gamification_challenges_user_code_uidx
  on public.gamification_challenges(user_id,code)
  where code is not null;

-- Seed a compact, non-anxiety-inducing default challenge set for each user
-- when their first gamified event arrives.
create or replace function public.ensure_default_gamification_challenges(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.gamification_challenges(user_id,code,title,description,target,progress,kind,status,starts_on,ends_on,reward_xp)
  values
    (p_user_id,'actions_10','10 acciones','Registra diez acciones reales en Personal OS.',10,0,'events','active',current_date,current_date+30,50),
    (p_user_id,'xp_250','250 XP','Acumula 250 XP mediante acciones reales.',250,0,'xp','active',current_date,current_date+30,100)
  on conflict (user_id,code) do nothing;
end
$$;

-- Automatic XP is intentionally modest. The same life event can never award
-- XP twice because gamification_xp_events has a unique user/event key.
create or replace function public.gamification_xp_for_event(p_entity_type text, p_payload jsonb)
returns integer
language sql
immutable
as $$
  select case p_entity_type
    when 'habit_logs' then 5
    when 'journal_entries' then 5
    when 'work_items' then 5
    when 'work_sessions' then 10
    when 'health_metrics' then 5
    when 'finance_transactions' then 2
    when 'learning_sessions' then 10
    when 'relationship_interactions' then 8
    when 'spiritual_entries' then 5
    when 'life_goals' then 5
    when 'routine_logs' then 5
    else 0
  end
$$;

create or replace function public.apply_gamification_for_life_event()
returns trigger
language plpgsql
as $$
declare
  earned integer;
  reason_text text;
  total_xp integer;
  new_level integer;
  action_count integer;
begin
  earned := public.gamification_xp_for_event(new.entity_type,new.payload);
  if earned <= 0 then
    return new;
  end if;

  reason_text := case new.entity_type
    when 'habit_logs' then 'Completaste un hábito.'
    when 'journal_entries' then 'Registraste una entrada.'
    when 'work_items' then 'Registraste una acción de trabajo.'
    when 'work_sessions' then 'Registraste una sesión de trabajo.'
    when 'health_metrics' then 'Registraste una medición de salud.'
    when 'finance_transactions' then 'Registraste una transacción.'
    when 'learning_sessions' then 'Registraste una sesión de aprendizaje.'
    when 'relationship_interactions' then 'Cuidaste una relación.'
    when 'spiritual_entries' then 'Registraste una práctica o reflexión espiritual.'
    when 'life_goals' then 'Registraste una acción relacionada con una meta.'
    when 'routine_logs' then 'Completaste una rutina.'
    else 'Acción registrada.'
  end;

  insert into public.gamification_xp_events(user_id,life_event_id,event_key,xp,reason)
  values(new.user_id,new.id,new.id::text,earned,reason_text)
  on conflict (user_id,event_key) do nothing;

  if not found then
    return new;
  end if;

  insert into public.gamification_profiles(user_id,xp,level)
  values(new.user_id,earned,1)
  on conflict (user_id) do update
    set xp = public.gamification_profiles.xp + excluded.xp,
        updated_at = now();

  select xp into total_xp
    from public.gamification_profiles
   where user_id = new.user_id;

  new_level := greatest(1,floor(total_xp / 100.0)::integer + 1);

  update public.gamification_profiles
     set level = new_level, updated_at = now()
   where user_id = new.user_id;

  perform public.ensure_default_gamification_challenges(new.user_id);

  update public.gamification_challenges
     set progress = least(target, progress + case when kind='xp' then earned else 0 end),
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'xp'
     and (starts_on is null or starts_on <= current_date)
     and (ends_on is null or ends_on >= current_date);

  update public.gamification_challenges
     set progress = least(target, progress + 1),
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'events'
     and (starts_on is null or starts_on <= current_date)
     and (ends_on is null or ends_on >= current_date);

  update public.gamification_challenges
     set status = 'completed', updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and progress >= target;

  -- Achievements are personal, deterministic milestones.
  insert into public.gamification_achievements(user_id,code,title,description,xp_reward)
  values
    (new.user_id,'first_action','Primera acción','Registraste tu primera acción en Personal OS.',10),
    (new.user_id,'ten_actions','Diez acciones','Registraste diez acciones reales.',25),
    (new.user_id,'first_relationship','Primera relación cuidada','Registraste tu primera interacción con una relación.',15),
    (new.user_id,'first_spiritual_entry','Primer registro espiritual','Registraste tu primera entrada espiritual.',15),
    (new.user_id,'first_learning_session','Primer aprendizaje','Registraste tu primera sesión de aprendizaje.',15),
    (new.user_id,'first_work_session','Primer bloque de trabajo','Registraste tu primera sesión de trabajo.',15)
  on conflict (user_id,code) do nothing;

  action_count := (select count(*) from public.gamification_xp_events where user_id = new.user_id);

  update public.gamification_achievements
     set unlocked_at = coalesce(unlocked_at,now())
   where user_id = new.user_id
     and unlocked_at is null
     and (
       code = 'first_action'
       or (code = 'ten_actions' and action_count >= 10)
       or (code = 'first_relationship' and new.entity_type = 'relationship_interactions')
       or (code = 'first_spiritual_entry' and new.entity_type = 'spiritual_entries')
       or (code = 'first_learning_session' and new.entity_type = 'learning_sessions')
       or (code = 'first_work_session' and new.entity_type = 'work_sessions')
     );

  return new;
end
$$;

drop trigger if exists gamification_from_life_event on public.life_events;
create trigger gamification_from_life_event
after insert on public.life_events
for each row execute function public.apply_gamification_for_life_event();

-- Capture a few additional meaningful Life Graph actions so the gamification
-- engine is not blind to them.
do $$
declare t text;
begin
  foreach t in array array['life_goals','routines','routine_logs','learning_items'] loop
    execute format('drop trigger if exists %I_life_event on public.%I',t,t);
    execute format(
      'create trigger %I_life_event after insert or update on public.%I
       for each row execute function public.emit_life_event()',
      t,t
    );
  end loop;
end
$$;

-- Ensure the new table and existing gamification tables remain owner-scoped.
do $$
declare t text;
begin
  foreach t in array array['gamification_profiles','gamification_achievements','gamification_challenges','gamification_xp_events','spiritual_goals'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon',t);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
  end loop;
end
$$;
