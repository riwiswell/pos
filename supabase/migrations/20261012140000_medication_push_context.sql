-- Personal OS: provide useful context in background medication push notifications.
-- Append-only; does not modify existing dose history or reschedule current jobs.

create or replace function public.sync_medication_notification()
returns trigger
language plpgsql
as $$
declare
  med record;
  offset_min integer;
  fire_at timestamptz;
  dose_text text;
  local_time text;
begin
  delete from public.notification_jobs
   where user_id = new.user_id
     and source_type = 'medication_dose'
     and source_id = new.id
     and status = 'pending';

  if new.status = 'taken' then
    return new;
  end if;

  select m.name, m.dose, m.unit, m.remind_offset_min
    into med
    from public.medications m
   where m.id = new.medication_id
     and m.user_id = new.user_id
     and m.active = true;

  if not found then
    return new;
  end if;

  offset_min := coalesce(med.remind_offset_min, 0);
  fire_at := coalesce(
    new.snoozed_until,
    new.scheduled_at - make_interval(mins => greatest(0, offset_min))
  );

  if fire_at > now() then
    dose_text := nullif(trim(coalesce(med.dose::text, '') || ' ' || coalesce(med.unit, '')), '');
    local_time := to_char(new.scheduled_time::time, 'HH12:MI AM');

    insert into public.notification_jobs(
      user_id, source_type, source_id, fire_at, title, body, payload
    )
    values(
      new.user_id,
      'medication_dose',
      new.id,
      fire_at,
      '💊 ' || med.name,
      'Dosis: ' || coalesce(dose_text, 'según indicación') ||
        ' · Hora programada: ' || local_time ||
        ' · Agua con esta toma: elige los vasos al marcarla.',
      jsonb_build_object(
        'dose_id', new.id,
        'medication_id', new.medication_id,
        'scheduled_time', new.scheduled_time,
        'water_glasses', new.water_glasses
      )
    );
  end if;

  return new;
end
$$;
