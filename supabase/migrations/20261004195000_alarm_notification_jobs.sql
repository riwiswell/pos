-- Persistent alarm jobs: the alarm row is the single source of truth.
create or replace function public.sync_alarm_notification()
returns trigger
language plpgsql
as $$
declare
  fire_at timestamptz;
begin
  delete from public.notification_jobs
   where user_id = new.user_id
     and source_type = 'alarm'
     and source_id = new.id
     and status = 'pending';

  if not new.enabled then
    return new;
  end if;

  fire_at := coalesce(new.snoozed_until, new.alarm_at);
  if fire_at > now() then
    insert into public.notification_jobs(
      user_id, source_type, source_id, fire_at, title, body, payload, status
    )
    values(
      new.user_id,
      'alarm',
      new.id,
      fire_at,
      '⏰ ' || new.title,
      coalesce(new.description, 'Alarma de Personal OS'),
      jsonb_build_object(
        'kind', 'alarm',
        'repeat_rule', new.repeat_rule,
        'alarm_id', new.id
      ),
      'pending'
    );
  end if;

  return new;
end
$$;

drop trigger if exists alarm_notification_job on public.alarms;
create trigger alarm_notification_job
after insert or update of alarm_at, repeat_rule, enabled, snoozed_until, title, description
on public.alarms
for each row execute function public.sync_alarm_notification();
