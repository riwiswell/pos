-- Personal OS: gamification correctness patch.
-- Append-only. This fixes the partial unique-index conflict target and ensures
-- achievement rewards are granted exactly once.

create or replace function public.ensure_default_gamification_challenges(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.gamification_challenges(
    user_id,code,title,description,target,progress,kind,status,starts_on,ends_on,reward_xp
  )
  values
    (p_user_id,'actions_10','10 acciones','Registra diez acciones reales en Personal OS.',10,0,'events','active',current_date,current_date+30,50),
    (p_user_id,'xp_250','250 XP','Acumula 250 XP mediante acciones reales.',250,0,'xp','active',current_date,current_date+30,100)
  on conflict (user_id,code) where code is not null do nothing;
end
$$;

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
begin
  earned := public.gamification_xp_for_event(new.entity_type,new.payload);
  if earned <= 0 then
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
  values(new.user_id,new.id,new.id::text,earned,reason_text)
  on conflict (user_id,event_key) do nothing;

  if not found then
    return new;
  end if;

  insert into public.gamification_profiles(user_id,xp,level)
  values(new.user_id,earned,1)
  on conflict (user_id) do update
    set xp = public.gamification_profiles.xp + excluded.xp,
        updated_at = now();

  perform public.ensure_default_gamification_challenges(new.user_id);

  update public.gamification_challenges
     set progress = least(target, progress + case when kind='xp' then earned else 0 end),
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'xp'
     and (starts_on is null or starts_on <= current_date)
     and (ends_on is null or ends_on >= current_date);

  update public.gamification_challenges
     set progress = least(target, progress + 1),
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'events'
     and (starts_on is null or starts_on <= current_date)
     and (ends_on is null or ends_on >= current_date);

  update public.gamification_challenges
     set status = 'completed', updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and progress >= target;

  insert into public.gamification_achievements(user_id,code,title,description,xp_reward)
  values
    (new.user_id,'first_action','Primera acción','Registraste tu primera acción en Personal OS.',10),
    (new.user_id,'ten_actions','Diez acciones','Registraste diez acciones reales.',25),
    (new.user_id,'first_relationship','Primera relación cuidada','Registraste tu primera interacción con una relación.',15),
    (new.user_id,'first_spiritual_entry','Primer registro espiritual','Registraste tu primera entrada espiritual.',15),
    (new.user_id,'first_learning_session','Primer aprendizaje','Registraste tu primera sesión de aprendizaje.',15),
    (new.user_id,'first_work_session','Primer bloque de trabajo','Registraste tu primera sesión de trabajo.',15)
  on conflict (user_id,code) do nothing;

  action_count := (select count(*) from public.gamification_xp_events where user_id = new.user_id);

  update public.gamification_achievements
     set unlocked_at = coalesce(unlocked_at,now())
   where user_id = new.user_id
     and unlocked_at is null
     and (
       code = 'first_action'
       or (code = 'ten_actions' and action_count >= 10)
       or (code = 'first_relationship' and new.entity_type = 'relationship_interactions')
       or (code = 'first_spiritual_entry' and new.entity_type = 'spiritual_entries')
       or (code = 'first_learning_session' and new.entity_type = 'learning_sessions')
       or (code = 'first_work_session' and new.entity_type = 'work_sessions')
     );

  -- Award each newly unlocked achievement once. The unique event_key is the
  -- idempotency guard even if the surrounding transaction is retried.
  for achievement in
    select id,code,title,xp_reward
      from public.gamification_achievements
     where user_id = new.user_id
       and unlocked_at is not null
       and unlocked_at >= now() - interval '2 seconds'
       and xp_reward > 0
  loop
    achievement_xp := achievement.xp_reward;
    insert into public.gamification_xp_events(user_id,life_event_id,event_key,xp,reason)
    values(
      new.user_id,
      new.id,
      'achievement:' || achievement.code,
      achievement_xp,
      'Logro desbloqueado: ' || achievement.title
    )
    on conflict (user_id,event_key) do nothing;

    if found then
      update public.gamification_profiles
         set xp = xp + achievement_xp,
             updated_at = now()
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

drop trigger if exists gamification_from_life_event on public.life_events;
create trigger gamification_from_life_event
after insert on public.life_events
for each row execute function public.apply_gamification_for_life_event();

-- Sanity indexes for the idempotency path.
create unique index if not exists gamification_xp_events_user_key_uidx
  on public.gamification_xp_events(user_id,event_key);
