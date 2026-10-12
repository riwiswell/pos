-- Award work-session XP when an active session transitions to completed.
-- The event bus emits this lifecycle event from an UPDATE, not an INSERT.
-- A stable work_sessions:<id>:completed event key keeps later edits idempotent.

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
      and coalesce(p_payload->>'status', '') = 'completed'
      and coalesce(p_payload->>'_operation', 'INSERT') in ('INSERT', 'UPDATE')
      then 10
    when coalesce(p_payload->>'_operation', 'INSERT') <> 'INSERT' then 0
    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'habit_kind', 'habit') <> 'habit' then 0
    when p_entity_type = 'habit_logs' then 5
    when p_entity_type = 'journal_entries' then 5
    when p_entity_type = 'work_items' then 5
    when p_entity_type = 'work_sessions' then 0
    when p_entity_type = 'health_metrics' then 5
    when p_entity_type = 'finance_transactions' then 2
    when p_entity_type = 'learning_sessions' then 10
    when p_entity_type = 'relationship_interactions' then 8
    when p_entity_type = 'spiritual_entries' then 5
    when p_entity_type = 'life_goals' then 5
    when p_entity_type = 'routine_logs'
      and coalesce((p_payload->>'completed')::boolean, false) = false then 0
    when p_entity_type = 'routine_logs' then 5
    else 0
  end
$$;
