-- Keep future inventory-estimated doses eligible for reminders until the user confirms them.
alter table public.medication_doses
  add column if not exists entry_origin text not null default 'manual';

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

  -- A manually taken dose is complete. A skipped dose is also complete.
  -- A stock_estimate marked "taken" is only an inventory reconstruction:
  -- keep the reminder alive if its scheduled time is still in the future.
  if new.status = 'skipped'
     or (new.status = 'taken' and coalesce(new.entry_origin, 'manual') <> 'stock_estimate') then
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
      'Confirma si tomaste o no tu dosis programada.',
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
after insert or update of status, snoozed_until, scheduled_at, medication_id, entry_origin
on public.medication_doses
for each row execute function public.sync_medication_notification();

-- Re-evaluate existing future stock estimates so they receive a reminder job
-- when background push is configured. The no-op assignment intentionally fires
-- the trigger without changing their estimated origin or inventory balance.
update public.medication_doses
   set entry_origin = 'stock_estimate'
 where entry_origin = 'stock_estimate'
   and status = 'taken'
   and scheduled_at > now();
