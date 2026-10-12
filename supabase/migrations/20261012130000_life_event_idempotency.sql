-- Personal OS: idempotent Life Graph events.
-- Each source entity emits at most one "recorded" event. Edits can update the
-- entity, but cannot mint more XP simply by changing a note or toggling a field.
-- Existing life_events and XP ledgers are preserved.

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
begin
  payload := to_jsonb(new) || jsonb_build_object('_operation', tg_op);

  if tg_table_name = 'habit_logs' then
    select h.kind
      into habit_kind
      from public.habits h
     where h.id = new.habit_id
       and h.user_id = new.user_id;

    payload := payload || jsonb_build_object(
      'habit_kind',
      coalesce(habit_kind, 'habit')
    );
  end if;

  -- Stable for the lifetime of the source row. The unique(user_id,event_key)
  -- constraint makes retries and updates idempotent.
  key := case
    -- A work session earns its completion reward exactly once. Its INSERT event
    -- is intentionally non-rewarding while it is active; completion is a second,
    -- stable lifecycle event, not an arbitrary edit.
    when tg_table_name = 'work_sessions' and payload->>'status' = 'completed'
      then tg_table_name || ':' || new.id::text || ':completed'
    else tg_table_name || ':' || new.id::text
  end;

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
    when coalesce(p_payload->>'_operation', 'INSERT') <> 'INSERT' then 0
    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'habit_kind', 'habit') <> 'habit' then 0
    when p_entity_type = 'habit_logs' then 5
    when p_entity_type = 'journal_entries' then 5
    when p_entity_type = 'work_items' then 5
    when p_entity_type = 'work_sessions'
      and coalesce(p_payload->>'status', '') <> 'completed' then 0
    when p_entity_type = 'work_sessions' then 10
    when p_entity_type = 'health_metrics' then 5
    when p_entity_type = 'finance_transactions' then 2
    when p_entity_type = 'learning_sessions' then 10
    when p_entity_type = 'relationship_interactions' then 8
    when p_entity_type = 'spiritual_entries' then 5
    when p_entity_type = 'life_goals' then 5
    when p_entity_type = 'routine_logs' then 5
    else 0
  end
$$;
