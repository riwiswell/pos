-- Personal OS: reward completed planner tasks and appointments.
-- Append-only migration. Idempotent per planner item; no historical XP is minted.

create or replace function public.emit_planner_completion_life_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
begin
  if coalesce(new.status, '') <> 'done' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') = 'done' then
    return new;
  end if;

  payload := to_jsonb(new) || jsonb_build_object(
    '_operation', tg_op,
    '_completion_event', true
  );

  insert into public.life_events(
    user_id,
    event_key,
    event_type,
    entity_type,
    entity_id,
    event_at,
    payload
  )
  values(
    new.user_id,
    'planner_items:' || new.id::text || ':completed',
    'completed',
    'planner_items',
    new.id,
    coalesce(
      nullif(payload->>'completed_at', '')::timestamptz,
      nullif(payload->>'updated_at', '')::timestamptz,
      nullif(payload->>'created_at', '')::timestamptz,
      now()
    ),
    payload
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end
$$;

drop trigger if exists planner_items_completion_life_event on public.planner_items;
create trigger planner_items_completion_life_event
after insert or update of status on public.planner_items
for each row execute function public.emit_planner_completion_life_event();

create or replace function public.gamification_xp_for_event(
  p_entity_type text,
  p_payload jsonb
)
returns integer
language sql
immutable
as $$
  select case
    when p_entity_type = 'work_sessions'
      and coalesce(p_payload->>'status','') = 'completed'
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE')
      then 10

    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'habit_kind','habit') <> 'habit' then 0
    when p_entity_type = 'habit_logs'
      and coalesce((p_payload->>'completed')::boolean,false) = false
      and coalesce(nullif(p_payload->>'value','')::numeric,0) <= 0 then 0
    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE') then 5

    when p_entity_type = 'routine_logs'
      and coalesce((p_payload->>'completed')::boolean,false) = true
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE') then 5
    when p_entity_type = 'routine_logs' then 0

    -- A task or appointment earns XP only when it transitions into completed.
    -- The separate planner event key prevents a duplicate reward on later edits.
    when p_entity_type = 'planner_items'
      and coalesce(p_payload->>'status','') = 'done'
      and coalesce(p_payload->>'_completion_event','false') = 'true'
      then 5

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
