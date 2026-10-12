-- Keep relationship reminders in sync with the user's saved preference.
-- Also cancel queued jobs when a relationship is deleted. Appointment and medication
-- reminders are independent and are not affected by this preference.

create or replace function public.refresh_relationship_notification_trigger()
returns trigger
language plpgsql
as $$
declare
  y integer;
  next_year integer;
  b date;
  month_part integer;
  day_part integer;
  fire_at timestamptz;
  notifications_enabled boolean := true;
begin
  if tg_op = 'DELETE' then
    delete from public.notification_jobs
     where user_id = old.user_id
       and source_type = 'relationship'
       and source_id = old.id
       and status = 'pending';
    return old;
  end if;

  delete from public.notification_jobs
   where user_id = new.user_id
     and source_type = 'relationship'
     and source_id = new.id
     and status = 'pending';

  select coalesce(p.notification_preferences->>'relationships', 'true') <> 'false'
    into notifications_enabled
    from public.profiles p
   where p.id = new.user_id;
  notifications_enabled := coalesce(notifications_enabled, true);

  if not notifications_enabled then
    return new;
  end if;

  y := extract(year from (now() at time zone 'America/Bogota'))::integer;
  -- Use the user's local calendar day and 09:00 local time rather than midnight
  -- UTC (which would deliver at 19:00 on the previous day in Colombia).
  if new.birthday is not null then
    month_part := extract(month from new.birthday)::integer;
    day_part := extract(day from new.birthday)::integer;
    b := case
      when month_part = 2 and day_part = 29 and not (
        mod(y, 4) = 0 and (mod(y, 100) <> 0 or mod(y, 400) = 0)
      ) then make_date(y, 2, 28)
      else make_date(y, month_part, day_part)
    end;
    if b < (now() at time zone 'America/Bogota')::date then
      next_year := y + 1;
      b := case
        when month_part = 2 and day_part = 29 and not (
          mod(next_year, 4) = 0 and (mod(next_year, 100) <> 0 or mod(next_year, 400) = 0)
        ) then make_date(next_year, 2, 28)
        else make_date(next_year, month_part, day_part)
      end;
    end if;
    fire_at := make_timestamptz(
      extract(year from (b - 7))::integer,
      extract(month from (b - 7))::integer,
      extract(day from (b - 7))::integer,
      9, 0, 0, 'America/Bogota'
    );
    if fire_at > now() then
      insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
      values (
        new.user_id,'relationship',new.id,fire_at,
        'Cumpleaños de ' || new.name,
        'Cumpleaños de ' || new.name || ' en una semana.',
        jsonb_build_object('kind','birthday','event_on',b)
      );
    end if;
  end if;

  if new.anniversary is not null then
    month_part := extract(month from new.anniversary)::integer;
    day_part := extract(day from new.anniversary)::integer;
    b := case
      when month_part = 2 and day_part = 29 and not (
        mod(y, 4) = 0 and (mod(y, 100) <> 0 or mod(y, 400) = 0)
      ) then make_date(y, 2, 28)
      else make_date(y, month_part, day_part)
    end;
    if b < (now() at time zone 'America/Bogota')::date then
      next_year := y + 1;
      b := case
        when month_part = 2 and day_part = 29 and not (
          mod(next_year, 4) = 0 and (mod(next_year, 100) <> 0 or mod(next_year, 400) = 0)
        ) then make_date(next_year, 2, 28)
        else make_date(next_year, month_part, day_part)
      end;
    end if;
    fire_at := make_timestamptz(
      extract(year from (b - 7))::integer,
      extract(month from (b - 7))::integer,
      extract(day from (b - 7))::integer,
      9, 0, 0, 'America/Bogota'
    );
    if fire_at > now() then
      insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
      values (
        new.user_id,'relationship',new.id,fire_at,
        'Aniversario de ' || new.name,
        'Aniversario de ' || new.name || ' en una semana.',
        jsonb_build_object('kind','anniversary','event_on',b)
      );
    end if;
  end if;

  if new.next_contact_on is not null then
    fire_at := make_timestamptz(
      extract(year from new.next_contact_on)::integer,
      extract(month from new.next_contact_on)::integer,
      extract(day from new.next_contact_on)::integer,
      9, 0, 0, 'America/Bogota'
    );
    if fire_at > now() then
      insert into public.notification_jobs(user_id,source_type,source_id,fire_at,title,body,payload)
      values (
        new.user_id,'relationship',new.id,fire_at,
        'Seguimiento: ' || new.name,
        'Hoy tienes previsto cuidar esta relación.',
        jsonb_build_object('kind','relationship_follow_up','event_on',new.next_contact_on)
      );
    end if;
  end if;

  return new;
end
$$;
