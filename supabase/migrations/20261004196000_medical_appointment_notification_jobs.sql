-- Persist appointment reminder jobs so alarms fire even when the browser is closed.
-- Append-only migration: the appointment row remains the single source of truth.

create or replace function public.sync_medical_appointment_notification()
returns trigger
language plpgsql
as $$
declare
  reminder integer;
  fire_at timestamptz;
begin
  if tg_op = 'DELETE' then
    delete from public.notification_jobs
     where user_id = old.user_id
       and source_type = 'medical_appointment'
       and source_id = old.id
       and status = 'pending';
    return old;
  end if;

  delete from public.notification_jobs
   where user_id = new.user_id
     and source_type = 'medical_appointment'
     and source_id = new.id
     and status = 'pending';

  if not new.alarm_enabled or new.status <> 'scheduled' then
    return new;
  end if;

  for reminder in
    select distinct unnest(coalesce(new.reminder_minutes, array[]::integer[]))
  loop
    fire_at := new.appointment_at - make_interval(mins => greatest(0, reminder));

    if fire_at > now() then
      insert into public.notification_jobs(
        user_id, source_type, source_id, fire_at, title, body, payload, status
      )
      values (
        new.user_id,
        'medical_appointment',
        new.id,
        fire_at,
        'Cita médica: ' || new.title,
        case
          when reminder >= 1440 then 'Tienes una cita médica próximamente.'
          when reminder >= 60 then 'Tu cita médica se aproxima.'
          else 'Tu cita médica está por comenzar.'
        end,
        jsonb_build_object(
          'kind', 'medical_appointment',
          'appointment_id', new.id,
          'appointment_at', new.appointment_at,
          'reminder_minutes', reminder
        ),
        'pending'
      );
    end if;
  end loop;

  return new;
end
$$;

drop trigger if exists medical_appointment_notification_job on public.medical_appointments;
create trigger medical_appointment_notification_job
after insert or update of appointment_at, status, reminder_minutes, alarm_enabled, title, provider, location
or delete
on public.medical_appointments
for each row execute function public.sync_medical_appointment_notification();

-- Backfill future reminders for appointments that existed before this trigger.
do $$
declare
  appointment record;
  reminder integer;
  fire_at timestamptz;
begin
  for appointment in
    select * from public.medical_appointments
     where alarm_enabled = true and status = 'scheduled'
  loop
    for reminder in
      select distinct unnest(coalesce(appointment.reminder_minutes, array[]::integer[]))
    loop
      fire_at := appointment.appointment_at - make_interval(mins => greatest(0, reminder));
      if fire_at > now() and not exists (
        select 1 from public.notification_jobs job
         where job.user_id = appointment.user_id
           and job.source_type = 'medical_appointment'
           and job.source_id = appointment.id
           and job.fire_at = fire_at
           and job.status = 'pending'
      ) then
        insert into public.notification_jobs(
          user_id, source_type, source_id, fire_at, title, body, payload, status
        )
        values (
          appointment.user_id,
          'medical_appointment',
          appointment.id,
          fire_at,
          'Cita médica: ' || appointment.title,
          case
            when reminder >= 1440 then 'Tienes una cita médica próximamente.'
            when reminder >= 60 then 'Tu cita médica se aproxima.'
            else 'Tu cita médica está por comenzar.'
          end,
          jsonb_build_object(
            'kind', 'medical_appointment',
            'appointment_id', appointment.id,
            'appointment_at', appointment.appointment_at,
            'reminder_minutes', reminder
          ),
          'pending'
        );
      end if;
    end loop;
  end loop;
end
$$;
