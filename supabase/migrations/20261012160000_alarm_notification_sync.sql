-- Personal OS: keep persistent background notifications synchronized with alarms.
-- Alarms are the source of truth; jobs are regenerated rather than restored from backups.

create or replace function public.sync_alarm_notification_job()
returns trigger
language plpgsql
as $$
declare
  fire_at timestamptz;
  step_days integer;
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

  -- If a recurring alarm is restored with an old date, schedule its next
  -- occurrence rather than firing an unbounded backlog of missed occurrences.
  if fire_at <= now() and new.repeat_rule in ('daily', 'weekly') and new.snoozed_until is null then
    step_days := case when new.repeat_rule = 'weekly' then 7 else 1 end;
    loop
      fire_at := fire_at + make_interval(days => step_days);
      exit when fire_at > now();
    end loop;
  end if;

  -- One-time alarms that are already in the past are not pushed as stale jobs.
  if fire_at <= now() then
    return new;
  end if;

  insert into public.notification_jobs(
    user_id, source_type, source_id, fire_at, title, body, payload, status
  )
  values(
    new.user_id,
    'alarm',
    new.id,
    fire_at,
    '⏰ ' || new.title,
    coalesce(nullif(trim(new.description), ''), 'Alarma de Personal OS'),
    jsonb_build_object(
      'alarm_id', new.id,
      'repeat_rule', new.repeat_rule,
      'snoozed', new.snoozed_until is not null
    ),
    'pending'
  );

  return new;
end
$$;

drop trigger if exists alarms_sync_notification_job on public.alarms;
create trigger alarms_sync_notification_job
after insert or update of alarm_at, repeat_rule, enabled, snoozed_until, title, description
on public.alarms
for each row execute function public.sync_alarm_notification_job();
