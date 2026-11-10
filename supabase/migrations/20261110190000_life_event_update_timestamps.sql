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
