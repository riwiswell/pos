-- Prevent repeat XP for edits to the same source record and calculate streaks
-- from the record's real calendar date. Existing XP is not retroactively changed.

create or replace function public.gamification_xp_for_event(p_entity_type text, p_payload jsonb)
returns integer
language sql
immutable
as $
  select case
    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'habit_kind', 'habit') <> 'habit' then 0
    when p_entity_type = 'habit_logs' then 5
    when p_entity_type = 'journal_entries' then 5
    when p_entity_type = 'work_items' then 5
    -- Starting a timer is not a completed work session and must not award XP.
    when p_entity_type = 'work_sessions'
      and coalesce(p_payload->>'status', 'completed') <> 'completed' then 0
    when p_entity_type = 'work_sessions' then 10
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
$;


create or replace function public.apply_gamification_for_life_event()
returns trigger
language plpgsql
as $$
declare
  earned integer;
  reason_text text;
  total_xp integer;
  new_level integer;
  action_count integer;
  achievement record;
  achievement_xp integer;
  activity_date date;
  local_today date;
  streak integer;
begin
  earned := public.gamification_xp_for_event(new.entity_type,new.payload);
  if earned <= 0 then
    return new;
  end if;

  local_today := (now() at time zone 'America/Bogota')::date;
  activity_date := case new.entity_type
    when 'habit_logs' then nullif(new.payload->>'log_date','')::date
    when 'journal_entries' then nullif(new.payload->>'entry_date','')::date
    when 'finance_transactions' then nullif(new.payload->>'occurred_on','')::date
    when 'health_metrics' then nullif(new.payload->>'metric_date','')::date
    when 'learning_sessions' then nullif(new.payload->>'session_date','')::date
    when 'relationship_interactions' then nullif(new.payload->>'interaction_on','')::date
    when 'spiritual_entries' then nullif(new.payload->>'entry_date','')::date
    when 'work_sessions' then nullif(new.payload->>'session_date','')::date
    when 'routine_logs' then nullif(new.payload->>'log_date','')::date
    else (new.event_at at time zone 'America/Bogota')::date
  end;
  activity_date := least(coalesce(activity_date,local_today),local_today);

  -- Older versions keyed XP to each life_events row, which changes on edits.
  -- Detect an existing reward for the same source entity before awarding again.
  if exists (
    select 1
      from public.gamification_xp_events ge
      join public.life_events le on le.id = ge.life_event_id
     where ge.user_id = new.user_id
       and ge.event_key not like 'achievement:%'
       and le.entity_type = new.entity_type
       and le.entity_id = new.entity_id
  ) then
    return new;
  end if;

  reason_text := case new.entity_type
    when 'habit_logs' then 'Completaste un hábito.'
    when 'journal_entries' then 'Registraste una entrada.'
    when 'work_items' then 'Registraste una acción de trabajo.'
    when 'work_sessions' then 'Registraste una sesión de trabajo.'
    when 'health_metrics' then 'Registraste una medición de salud.'
    when 'finance_transactions' then 'Registraste una transacción.'
    when 'learning_sessions' then 'Registraste una sesión de aprendizaje.'
    when 'relationship_interactions' then 'Cuidaste una relación.'
    when 'spiritual_entries' then 'Registraste una práctica o reflexión espiritual.'
    when 'life_goals' then 'Registraste una acción relacionada con una meta.'
    when 'routine_logs' then 'Completaste una rutina.'
    else 'Acción registrada.'
  end;

  insert into public.gamification_xp_events(user_id,life_event_id,event_key,xp,reason)
  values(new.user_id,new.id,'record:'||new.entity_type||':'||coalesce(new.entity_id::text,new.id::text),earned,reason_text)
  on conflict (user_id,event_key) do nothing;

  if not found then
    return new;
  end if;

  insert into public.gamification_profiles(user_id,xp,level,current_streak,best_streak,last_activity_on)
  values(
    new.user_id,earned,1,
    case when activity_date >= local_today - 1 then 1 else 0 end,
    1,
    activity_date
  )
  on conflict (user_id) do update
    set xp = public.gamification_profiles.xp + excluded.xp,
        updated_at = now(),
        current_streak = case
          when public.gamification_profiles.last_activity_on is null then excluded.current_streak
          when activity_date <= public.gamification_profiles.last_activity_on then public.gamification_profiles.current_streak
          when public.gamification_profiles.last_activity_on = activity_date - 1 then public.gamification_profiles.current_streak + 1
          else excluded.current_streak
        end,
        best_streak = greatest(
          public.gamification_profiles.best_streak,
          case
            when public.gamification_profiles.last_activity_on is null then 1
            when activity_date <= public.gamification_profiles.last_activity_on then public.gamification_profiles.current_streak
            when public.gamification_profiles.last_activity_on = activity_date - 1 then public.gamification_profiles.current_streak + 1
            else 1
          end
        ),
        last_activity_on = greatest(coalesce(public.gamification_profiles.last_activity_on,activity_date),activity_date);

  perform public.ensure_default_gamification_challenges(new.user_id);

  select xp,current_streak into total_xp,streak
    from public.gamification_profiles
   where user_id = new.user_id;

  new_level := greatest(1,floor(total_xp / 100.0)::integer + 1);

  update public.gamification_profiles
     set level = new_level, updated_at = now()
   where user_id = new.user_id;

  update public.gamification_challenges
     set progress = least(target, progress + case when kind='xp' then earned else 0 end),
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'xp'
     and (starts_on is null or starts_on <= local_today)
     and (ends_on is null or ends_on >= local_today);

  update public.gamification_challenges
     set progress = least(target, progress + 1),
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'events'
     and (starts_on is null or starts_on <= local_today)
     and (ends_on is null or ends_on >= local_today);

  update public.gamification_challenges
     set progress = least(target, streak),
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'streak_days'
     and (starts_on is null or starts_on <= local_today)
     and (ends_on is null or ends_on >= local_today);

  update public.gamification_challenges
     set status = 'completed', updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and progress >= target;

  insert into public.gamification_achievements(user_id,code,title,description,xp_reward)
  values
    (new.user_id,'first_action','Primera acción','Registraste tu primera acción en Personal OS.',10),
    (new.user_id,'ten_actions','Diez acciones','Registraste diez acciones reales.',25),
    (new.user_id,'seven_day_streak','Siete días','Mantuviste actividad durante siete días consecutivos.',30),
    (new.user_id,'first_relationship','Primera relación cuidada','Registraste tu primera interacción con una relación.',15),
    (new.user_id,'first_spiritual_entry','Primer registro espiritual','Registraste tu primera entrada espiritual.',15),
    (new.user_id,'first_learning_session','Primer aprendizaje','Registraste tu primera sesión de aprendizaje.',15),
    (new.user_id,'first_work_session','Primer bloque de trabajo','Registraste tu primera sesión de trabajo.',15)
  on conflict (user_id,code) do nothing;

  select count(*)::integer into action_count
    from (
      select distinct le.entity_type,le.entity_id
        from public.gamification_xp_events ge
        join public.life_events le on le.id = ge.life_event_id
       where ge.user_id = new.user_id
         and ge.event_key not like 'achievement:%'
    ) source_actions;

  for achievement in
    update public.gamification_achievements
       set unlocked_at = now()
     where user_id = new.user_id
       and unlocked_at is null
       and (
         code = 'first_action'
         or (code = 'ten_actions' and action_count >= 10)
         or (code = 'seven_day_streak' and streak >= 7)
         or (code = 'first_relationship' and new.entity_type = 'relationship_interactions')
         or (code = 'first_spiritual_entry' and new.entity_type = 'spiritual_entries')
         or (code = 'first_learning_session' and new.entity_type = 'learning_sessions')
         or (code = 'first_work_session' and new.entity_type = 'work_sessions')
       )
     returning id,code,title,xp_reward
  loop
    achievement_xp := achievement.xp_reward;
    insert into public.gamification_xp_events(user_id,life_event_id,event_key,xp,reason)
    values(new.user_id,new.id,'achievement:'||achievement.code,achievement_xp,'Logro desbloqueado: '||achievement.title)
    on conflict (user_id,event_key) do nothing;

    if found then
      update public.gamification_profiles
         set xp = xp + achievement_xp, updated_at = now()
       where user_id = new.user_id;
    end if;
  end loop;

  select xp into total_xp
    from public.gamification_profiles
   where user_id = new.user_id;

  new_level := greatest(1,floor(total_xp / 100.0)::integer + 1);

  update public.gamification_profiles
     set level = new_level, updated_at = now()
   where user_id = new.user_id;

  return new;
end
$$;
