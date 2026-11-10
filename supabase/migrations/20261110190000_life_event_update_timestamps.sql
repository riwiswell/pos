-- Keep the life timeline chronological when an existing record is edited.
-- Each UPDATE produces one fresh event; INSERT remains keyed to the record creation time.
create or replace function public.emit_life_event()
returns trigger
language plpgsql
as $$
declare
  payload jsonb;
  key text;
  occurred_at timestamptz;
begin
  payload := to_jsonb(new);

  if tg_op = 'UPDATE' then
    occurred_at := clock_timestamp();
  else
    occurred_at := coalesce(
      nullif(payload->>'created_at', '')::timestamptz,
      clock_timestamp()
    );
  end if;

  key := tg_table_name || ':' || new.id::text || ':' ||
    to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

  insert into public.life_events(
    user_id, event_key, event_type, entity_type, entity_id, event_at, payload
  )
  values(
    new.user_id,
    key,
    case when tg_op = 'UPDATE' then 'updated' else 'recorded' end,
    tg_table_name,
    new.id,
    occurred_at,
    payload
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end
$$;
