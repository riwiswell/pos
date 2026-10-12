-- Personal OS: activities are not habits for gamification.
-- Append-only: preserve Life Graph events for both kinds, but only habit kind
-- contributes XP. Adding the parent kind to the event payload keeps the rule
-- deterministic and testable without trusting UI filters.

create or replace function public.emit_life_event()
returns trigger
language plpgsql
as $$
declare
  payload jsonb;
  key text;
  habit_kind text;
begin
  payload := to_jsonb(new);

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

  key := tg_table_name || ':' || new.id::text || ':' ||
    coalesce(payload->>'updated_at', payload->>'created_at', clock_timestamp()::text);

  insert into public.life_events(
    user_id, event_key, event_type, entity_type, entity_id, event_at, payload
  )
  values(
    new.user_id,
    key,
    'recorded',
    tg_table_name,
    new.id,
    coalesce((payload->>'created_at')::timestamptz, now()),
    payload
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end
$$;

create or replace function public.gamification_xp_for_event(p_entity_type text, p_payload jsonb)
returns integer
language sql
immutable
as $$
  select case
    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'habit_kind', 'habit') <> 'habit' then 0
    when p_entity_type = 'habit_logs' then 5
    when p_entity_type = 'journal_entries' then 5
    when p_entity_type = 'work_items' then 5
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
