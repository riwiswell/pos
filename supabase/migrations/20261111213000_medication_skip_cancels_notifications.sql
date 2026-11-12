-- A skipped medication dose is a terminal decision for that scheduled occurrence.
-- It must not leave or recreate a push notification for the dose.
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

  if new.status in ('taken', 'skipped') then
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
