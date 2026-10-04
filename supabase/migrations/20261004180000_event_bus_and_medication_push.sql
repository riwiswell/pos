-- Persistent notification rules and Life Graph event bus.
-- Append-only migration. Safe to apply after 20261004170000.

alter table public.learning_sessions
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.schedule_work_break_notification()
returns trigger
language plpgsql
as $$
declare
  fire_at timestamptz;
begin
  if new.status = 'completed' then
    delete from public.notification_jobs
     where user_id = new.user_id
       and source_type = 'work_session'
       and source_id = new.id
       and status = 'pending';
    return new;
  end if;

  if new.started_at is not null
     and (
       tg_op = 'INSERT'
       or old.started_at is distinct from new.started_at
       or old.target_minutes is distinct from new.target_minutes
     ) then
    delete from public.notification_jobs
     where user_id = new.user_id
       and source_type = 'work_session'
       and source_id = new.id
       and status = 'pending';

    fire_at := new.started_at + make_interval(mins => greatest(1, new.target_minutes));

    insert into public.notification_jobs(
      user_id, source_type, source_id, fire_at, title, body, payload
    )
    values(
      new.user_id,
      'work_session',
      new.id,
      fire_at,
      'Pausa de trabajo',
      'Llevas un bloque largo de trabajo. Tómate unos minutos para descansar.',
      jsonb_build_object(
        'kind', 'work_break',
        'target_minutes', new.target_minutes
      )
    );
  end if;

  return new;
end
$$;

drop trigger if exists schedule_work_break_notification on public.work_sessions;
create trigger schedule_work_break_notification
after insert or update of started_at, target_minutes, status
on public.work_sessions
for each row execute function public.schedule_work_break_notification();

create or replace function public.emit_life_event()
returns trigger
language plpgsql
as $$
declare
  payload jsonb;
  key text;
begin
  payload := to_jsonb(new);
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

do $$
declare
  t text;
begin
  foreach t in array array[
    'journal_entries',
    'work_items',
    'work_sessions',
    'health_metrics',
    'habit_logs',
    'finance_transactions',
    'learning_sessions',
    'relationship_interactions',
    'spiritual_entries'
  ] loop
    execute format('drop trigger if exists %I_life_event on public.%I', t, t);
    execute format(
      'create trigger %I_life_event after insert or update on public.%I
       for each row execute function public.emit_life_event()',
      t, t
    );
  end loop;
end
$$;

create or replace function public.sync_medication_notification()
returns trigger
language plpgsql
as $$
declare
  offset_min integer;
  fire_at timestamptz;
begin
  delete from public.notification_jobs
   where user_id = new.user_id
     and source_type = 'medication_dose'
     and source_id = new.id
     and status = 'pending';

  if new.status = 'taken' then
    return new;
  end if;

  select coalesce(m.remind_offset_min, 0)
    into offset_min
    from public.medications m
   where m.id = new.medication_id
     and m.user_id = new.user_id;

  fire_at := coalesce(
    new.snoozed_until,
    new.scheduled_at - make_interval(mins => greatest(0, offset_min))
  );

  if fire_at > now() then
    insert into public.notification_jobs(
      user_id, source_type, source_id, fire_at, title, body, payload
    )
    values(
      new.user_id,
      'medication_dose',
      new.id,
      fire_at,
      '💊 Recordatorio de medicamento',
      'Es hora de revisar tu dosis programada.',
      jsonb_build_object(
        'dose_id', new.id,
        'medication_id', new.medication_id
      )
    );
  end if;

  return new;
end
$$;

drop trigger if exists medication_dose_notification on public.medication_doses;
create trigger medication_dose_notification
after insert or update of status, snoozed_until, scheduled_at, medication_id
on public.medication_doses
for each row execute function public.sync_medication_notification();

create or replace function public.cancel_medication_notification()
returns trigger
language plpgsql
as $$
begin
  delete from public.notification_jobs
   where source_type = 'medication_dose'
     and source_id = old.id
     and status = 'pending';

  return old;
end
$$;

drop trigger if exists medication_dose_cancel_notification on public.medication_doses;
create trigger medication_dose_cancel_notification
before delete on public.medication_doses
for each row execute function public.cancel_medication_notification();
