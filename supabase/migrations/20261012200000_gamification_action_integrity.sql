-- Personal OS: award XP only for meaningful, idempotent actions.
-- Append-only: do not rewrite the migration history already used by hosted databases.

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
begin
  payload := to_jsonb(new) || jsonb_build_object('_operation', tg_op);

  if tg_table_name = 'habit_logs' then
    select h.kind
      into habit_kind
      from public.habits h
     where h.id = new.habit_id
       and h.user_id = new.user_id;

    payload := payload || jsonb_build_object('habit_kind', coalesce(habit_kind, 'habit'));

    -- An empty row is a draft/state container, not a completed activity.
    if coalesce((payload->>'completed')::boolean, false) = false
       and coalesce(nullif(payload->>'value','')::numeric,0) <= 0 then
      return new;
    end if;

    -- A historical source row may already have earned XP before this hardening.
    -- Do not mint a second reward under the newer progress-event key.
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
    -- A work session can have an initial (active) event and one completion event.
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

  elsif tg_op = 'UPDATE' then
    -- General edits are not new Life Graph events and must not mint XP.
    return new;

  else
    key := tg_table_name || ':' || new.id::text;
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
    coalesce((payload->>'created_at')::timestamptz, now()),
    payload
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end
$$;

create or replace function public.gamification_xp_for_event(
  p_entity_type text,
  p_payload jsonb
)
returns integer
language sql
immutable
as $$
  select case
    -- Work sessions reward the transition to completed, not starting or editing a session.
    when p_entity_type = 'work_sessions'
      and coalesce(p_payload->>'status','') = 'completed'
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE')
      then 10

    -- A habit earns at most one reward per daily log row, and activities never earn habit XP.
    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'habit_kind','habit') <> 'habit' then 0
    when p_entity_type = 'habit_logs'
      and coalesce((p_payload->>'completed')::boolean,false) = false
      and coalesce(nullif(p_payload->>'value','')::numeric,0) <= 0 then 0
    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE') then 5

    -- A routine earns XP only when its log is completed.
    when p_entity_type = 'routine_logs'
      and coalesce((p_payload->>'completed')::boolean,false) = true
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE') then 5
    when p_entity_type = 'routine_logs' then 0

    -- Other source entities can award XP only on their first recorded insert.
    when coalesce(p_payload->>'_operation','INSERT') <> 'INSERT' then 0
    when p_entity_type = 'journal_entries' then 5
    when p_entity_type = 'work_items' then 5
    when p_entity_type = 'health_metrics' then 5
    when p_entity_type = 'finance_transactions' then 2
    when p_entity_type = 'learning_sessions' then 10
    when p_entity_type = 'relationship_interactions' then 8
    when p_entity_type = 'spiritual_entries' then 5
    when p_entity_type = 'life_goals' then 5
    else 0
  end
$$;
