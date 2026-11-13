-- POS · Reparación completa de Gamificación y recuperación histórica de XP
-- Ejecutar el archivo COMPLETO una sola vez en el SQL Editor de Lovable.
-- Proyecto autorizado: eutrhjvdyrakrxmjemut.
-- No ejecutar en otro proyecto.
--
-- Este SQL instala primero el emisor de eventos y el motor de XP (que faltaban
-- en la base que produjo el error), después crea los premios especiales y,
-- al final, acredita el historial con claves idempotentes.
-- No borra ni modifica los registros fuente.

begin;

-- Asegurar las columnas que requiere el motor de rachas y desafíos.
alter table public.gamification_profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists best_streak integer not null default 0,
  add column if not exists last_activity_on date;

alter table public.gamification_challenges
  add column if not exists code text,
  add column if not exists kind text not null default 'events';

create unique index if not exists gamification_challenges_user_code_uidx
  on public.gamification_challenges(user_id, code)
  where code is not null;

-- Desafíos iniciales, creados solo una vez para cada usuario.
create or replace function public.ensure_default_gamification_challenges(p_user_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $ensure_challenges$
begin
  insert into public.gamification_challenges(
    user_id, code, title, description, target, progress, kind,
    status, starts_on, ends_on, reward_xp
  )
  values
    (p_user_id, 'actions_10', '10 acciones',
      'Registra diez acciones reales en Personal OS.', 10, 0,
      'events', 'active', (now() at time zone 'America/Bogota')::date,
      (now() at time zone 'America/Bogota')::date + 30, 50),
    (p_user_id, 'xp_250', '250 XP',
      'Acumula 250 XP mediante acciones reales.', 250, 0,
      'xp', 'active', (now() at time zone 'America/Bogota')::date,
      (now() at time zone 'America/Bogota')::date + 30, 100)
  on conflict (user_id, code) where code is not null do nothing;
end;
$ensure_challenges$;

-- Regla única de puntuación, compartida por registros nuevos y el histórico.
create or replace function public.gamification_xp_for_event(
  p_entity_type text,
  p_payload jsonb
)
returns integer
language sql
immutable
as $xp_score$
  select case
    when p_entity_type = 'work_sessions'
      and coalesce(p_payload->>'status','') = 'completed'
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE')
      then 10

    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'habit_kind','habit') <> 'habit' then 0
    when p_entity_type = 'habit_logs'
      and coalesce((p_payload->>'completed')::boolean,false) = false
      and coalesce(nullif(p_payload->>'value','')::numeric,0) <= 0 then 0
    when p_entity_type = 'habit_logs'
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE') then 5

    when p_entity_type = 'routine_logs'
      and coalesce((p_payload->>'completed')::boolean,false) = true
      and coalesce(p_payload->>'_operation','INSERT') in ('INSERT','UPDATE') then 5
    when p_entity_type = 'routine_logs' then 0

    when p_entity_type = 'planner_items'
      and coalesce(p_payload->>'status','') = 'done'
      and coalesce(p_payload->>'_completion_event','false') = 'true'
      then 5

    when coalesce(p_payload->>'_operation','INSERT') <> 'INSERT' then 0
    when p_entity_type = 'journal_entries' then 5
    when p_entity_type = 'work_items' then 5
    when p_entity_type = 'health_metrics' then 5
    when p_entity_type = 'finance_transactions' then 2
    when p_entity_type = 'learning_sessions' then 10
    when p_entity_type = 'relationship_interactions' then 8
    when p_entity_type = 'spiritual_entries' then 5
    when p_entity_type = 'life_goals' then 5
    else 0
  end
$xp_score$;

-- Emisor del Life Graph. El identificador del evento cambia al editar una fila,
-- pero la clave de XP será estable por registro: editar no duplica sus puntos.
create or replace function public.emit_life_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $life_event_emitter$
declare
  payload jsonb;
  event_key text;
  habit_kind_value text := 'habit';
begin
  payload := to_jsonb(new) || jsonb_build_object('_operation', tg_op);

  if tg_table_name = 'habit_logs' then
    select coalesce(h.kind, 'habit')
      into habit_kind_value
      from public.habits h
     where h.id = nullif(payload->>'habit_id', '')::uuid
       and h.user_id = new.user_id;

    payload := payload || jsonb_build_object(
      'habit_kind', coalesce(habit_kind_value, 'habit')
    );
  end if;

  event_key := tg_table_name || ':' || new.id::text || ':' ||
    coalesce(payload->>'updated_at', payload->>'created_at', clock_timestamp()::text);

  insert into public.life_events(
    user_id, event_key, event_type, entity_type, entity_id, event_at, payload
  )
  values(
    new.user_id,
    event_key,
    'recorded',
    tg_table_name,
    new.id,
    coalesce(
      nullif(payload->>'created_at', '')::timestamptz,
      nullif(payload->>'updated_at', '')::timestamptz,
      now()
    ),
    payload
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end;
$life_event_emitter$;

-- Instalar / reparar los emisores de las tablas que alimentan Gamificación.
do $install_emitters$
declare
  table_name text;
begin
  foreach table_name in array array[
    'journal_entries',
    'work_items',
    'work_sessions',
    'health_metrics',
    'habit_logs',
    'finance_transactions',
    'learning_sessions',
    'relationship_interactions',
    'spiritual_entries',
    'life_goals',
    'routines',
    'routine_logs',
    'learning_items'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'drop trigger if exists %I_life_event on public.%I',
        table_name, table_name
      );
      execute format(
        'create trigger %I_life_event
         after insert or update on public.%I
         for each row execute function public.emit_life_event()',
        table_name, table_name
      );
    end if;
  end loop;
end;
$install_emitters$;

-- Motor automático de XP. Una sola recompensa por registro fuente, incluso
-- cuando el mismo registro genera varios eventos de actualización.
create or replace function public.apply_gamification_for_life_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $apply_gamification$
declare
  earned integer;
  reason_text text;
  base_event_key text;
  inserted_count integer := 0;
  activity_date date;
  local_today date := (now() at time zone 'America/Bogota')::date;
  streak integer := 0;
  action_count integer := 0;
  achievement record;
  achievement_xp integer;
begin
  if new.user_id is null or new.entity_id is null then
    return new;
  end if;

  earned := public.gamification_xp_for_event(new.entity_type, new.payload);
  if earned <= 0 then
    return new;
  end if;

  base_event_key := 'record:' || new.entity_type || ':' || new.entity_id::text;

  -- Compatible con el ledger anterior (life_event_id) y con el nuevo event_key.
  if exists (
    select 1
      from public.gamification_xp_events ge
     where ge.user_id = new.user_id
       and (
         ge.event_key = base_event_key
         or ge.life_event_id = new.id
       )
  ) then
    return new;
  end if;

  reason_text := case new.entity_type
    when 'habit_logs' then 'Completaste un hábito.'
    when 'routine_logs' then 'Completaste una rutina.'
    when 'journal_entries' then 'Registraste una entrada en el diario.'
    when 'work_items' then 'Registraste una acción de trabajo.'
    when 'work_sessions' then 'Completaste una sesión de trabajo.'
    when 'health_metrics' then 'Registraste una medición de salud.'
    when 'finance_transactions' then 'Registraste una transacción financiera.'
    when 'learning_sessions' then 'Registraste una sesión de aprendizaje.'
    when 'relationship_interactions' then 'Cuidaste una relación.'
    when 'spiritual_entries' then 'Registraste una práctica o reflexión espiritual.'
    when 'life_goals' then 'Registraste una acción relacionada con una meta.'
    when 'planner_items' then 'Completaste una tarea o compromiso del Planeador.'
    else 'Acción registrada.'
  end;

  insert into public.gamification_xp_events(
    user_id, life_event_id, event_key, xp, reason
  )
  values (
    new.user_id, new.id, base_event_key, earned, reason_text
  )
  on conflict (user_id, event_key) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return new;
  end if;

  activity_date := least(
    coalesce((new.event_at at time zone 'America/Bogota')::date, local_today),
    local_today
  );

  insert into public.gamification_profiles(
    user_id, xp, level, current_streak, best_streak, last_activity_on
  )
  values (
    new.user_id, earned, 1, 1, 1, activity_date
  )
  on conflict (user_id) do update
    set xp = public.gamification_profiles.xp + excluded.xp,
        updated_at = now(),
        current_streak = case
          when public.gamification_profiles.last_activity_on = activity_date
            then public.gamification_profiles.current_streak
          when public.gamification_profiles.last_activity_on = activity_date - 1
            then public.gamification_profiles.current_streak + 1
          when public.gamification_profiles.last_activity_on is null
            or public.gamification_profiles.last_activity_on < activity_date - 1
            then 1
          else public.gamification_profiles.current_streak
        end,
        best_streak = greatest(
          public.gamification_profiles.best_streak,
          case
            when public.gamification_profiles.last_activity_on = activity_date
              then public.gamification_profiles.current_streak
            when public.gamification_profiles.last_activity_on = activity_date - 1
              then public.gamification_profiles.current_streak + 1
            when public.gamification_profiles.last_activity_on is null
              or public.gamification_profiles.last_activity_on < activity_date - 1
              then 1
            else public.gamification_profiles.current_streak
          end
        ),
        last_activity_on = greatest(
          coalesce(public.gamification_profiles.last_activity_on, activity_date),
          activity_date
        );

  perform public.ensure_default_gamification_challenges(new.user_id);

  select current_streak
    into streak
    from public.gamification_profiles
   where user_id = new.user_id;

  update public.gamification_challenges
     set progress = least(target, coalesce(progress, 0) + earned),
         status = case
           when coalesce(progress, 0) + earned >= target then 'completed'
           else status
         end,
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'xp'
     and (starts_on is null or starts_on <= local_today)
     and (ends_on is null or ends_on >= local_today);

  update public.gamification_challenges
     set progress = least(target, coalesce(progress, 0) + 1),
         status = case
           when coalesce(progress, 0) + 1 >= target then 'completed'
           else status
         end,
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'events'
     and (starts_on is null or starts_on <= local_today)
     and (ends_on is null or ends_on >= local_today);

  update public.gamification_challenges
     set progress = least(target, streak),
         status = case when streak >= target then 'completed' else status end,
         updated_at = now()
   where user_id = new.user_id
     and status = 'active'
     and kind = 'streak_days'
     and (starts_on is null or starts_on <= local_today)
     and (ends_on is null or ends_on >= local_today);

  insert into public.gamification_achievements(
    user_id, code, title, description, xp_reward
  )
  values
    (new.user_id, 'first_action', 'Primera acción',
      'Registraste tu primera acción en Personal OS.', 10),
    (new.user_id, 'ten_actions', 'Diez acciones',
      'Registraste diez acciones reales.', 25),
    (new.user_id, 'seven_day_streak', 'Siete días',
      'Mantuviste actividad durante siete días consecutivos.', 30),
    (new.user_id, 'first_relationship', 'Primera relación cuidada',
      'Registraste tu primera interacción con una relación.', 15),
    (new.user_id, 'first_spiritual_entry', 'Primer registro espiritual',
      'Registraste tu primera entrada espiritual.', 15),
    (new.user_id, 'first_learning_session', 'Primer aprendizaje',
      'Registraste tu primera sesión de aprendizaje.', 15),
    (new.user_id, 'first_work_session', 'Primer bloque de trabajo',
      'Registraste tu primera sesión de trabajo.', 15)
  on conflict (user_id, code) do nothing;

  select count(*)::integer
    into action_count
    from public.gamification_xp_events ge
   where ge.user_id = new.user_id
     and ge.xp > 0
     and ge.event_key not like 'achievement:%';

  for achievement in
    update public.gamification_achievements
       set unlocked_at = coalesce(unlocked_at, now())
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
     returning id, code, title, xp_reward
  loop
    achievement_xp := greatest(0, coalesce(achievement.xp_reward, 0));

    insert into public.gamification_xp_events(
      user_id, life_event_id, event_key, xp, reason
    )
    values (
      new.user_id,
      new.id,
      'achievement:' || achievement.code,
      achievement_xp,
      'Logro desbloqueado: ' || achievement.title
    )
    on conflict (user_id, event_key) do nothing;

    get diagnostics inserted_count = row_count;
    if inserted_count > 0 and achievement_xp > 0 then
      update public.gamification_profiles
         set xp = xp + achievement_xp,
             updated_at = now()
       where user_id = new.user_id;
    end if;
  end loop;

  return new;
end;
$apply_gamification$;

revoke all on function public.emit_life_event() from public, anon, authenticated;
revoke all on function public.apply_gamification_for_life_event() from public, anon, authenticated;

drop trigger if exists gamification_from_life_event on public.life_events;
create trigger gamification_from_life_event
after insert on public.life_events
for each row execute function public.apply_gamification_for_life_event();

-- El Planeador solo emite evento XP cuando una tarea/cita pasa a "done".
create or replace function public.emit_planner_completion_life_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $planner_completion$
declare
  payload jsonb;
begin
  if coalesce(new.status::text, '') <> 'done' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status::text, '') = 'done' then
    return new;
  end if;

  payload := to_jsonb(new) || jsonb_build_object(
    '_operation', tg_op,
    '_completion_event', true
  );

  insert into public.life_events(
    user_id, event_key, event_type, entity_type, entity_id, event_at, payload
  )
  values (
    new.user_id,
    'planner_items:' || new.id::text || ':completed',
    'recorded',
    'planner_items',
    new.id,
    coalesce(
      nullif(payload->>'completed_at', '')::timestamptz,
      nullif(payload->>'updated_at', '')::timestamptz,
      nullif(payload->>'created_at', '')::timestamptz,
      now()
    ),
    payload
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end;
$planner_completion$;

do $install_planner_trigger$
begin
  if to_regclass('public.planner_items') is not null then
    drop trigger if exists planner_items_completion_life_event on public.planner_items;
    create trigger planner_items_completion_life_event
      after insert or update of status on public.planner_items
      for each row execute function public.emit_planner_completion_life_event();
  end if;
end;
$install_planner_trigger$;

-- Premios por hitos para las acciones que no son registros genéricos.
-- 2) Único punto de escritura para bonos que no proceden de un life_event.
create or replace function public.award_personal_gamification_bonus(
  p_user_id uuid,
  p_event_key text,
  p_xp integer,
  p_reason text,
  p_trophy_code text default null,
  p_trophy_title text default null,
  p_trophy_description text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  inserted_count integer;
  local_today date := (now() at time zone 'America/Bogota')::date;
begin
  if p_user_id is null or nullif(trim(p_event_key), '') is null or coalesce(p_xp, 0) <= 0 then
    return false;
  end if;

  insert into public.gamification_xp_events(user_id, life_event_id, event_key, xp, reason)
  values (p_user_id, null, p_event_key, p_xp, coalesce(nullif(trim(p_reason), ''), 'Hito personal completado'))
  on conflict (user_id, event_key) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return false;
  end if;

  insert into public.gamification_profiles(user_id, xp, level)
  values (p_user_id, p_xp, 1)
  on conflict (user_id) do update
     set xp = public.gamification_profiles.xp + excluded.xp,
         updated_at = now();

  -- Los retos de XP también progresan con estos hitos; al completarse,
  -- su propio trigger entrega la recompensa configurada en el reto.
  update public.gamification_challenges
     set progress = least(target, coalesce(progress, 0) + p_xp),
         status = case
           when coalesce(progress, 0) + p_xp >= target then 'completed'
           else status
         end,
         updated_at = now()
   where user_id = p_user_id
     and status = 'active'
     and kind = 'xp'
     and (starts_on is null or starts_on <= local_today)
     and (ends_on is null or ends_on >= local_today);

  if nullif(trim(p_trophy_code), '') is not null then
    insert into public.gamification_achievements(
      user_id, code, title, description, xp_reward, unlocked_at
    )
    values (
      p_user_id,
      p_trophy_code,
      coalesce(nullif(trim(p_trophy_title), ''), 'Trofeo desbloqueado'),
      coalesce(nullif(trim(p_trophy_description), ''), 'Alcanzaste un hito personal.'),
      0,
      now()
    )
    on conflict (user_id, code) do update
      set unlocked_at = coalesce(public.gamification_achievements.unlocked_at, excluded.unlocked_at);
  end if;

  return true;
end;
$function$;

revoke all on function public.award_personal_gamification_bonus(uuid, text, integer, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.sync_gamification_level_200() from public, anon, authenticated;

-- 3) El motor ya entrega 10 XP por una sesión de aprendizaje.
--    Estos hitos reciben otros 10 XP una sola vez: 20 XP en total.
create or replace function public.award_learning_completion_bonus()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  activity text := coalesce(new.payload->>'activity_type', '');
  source_id text := coalesce(nullif(new.payload->>'learning_item_id', ''), new.entity_id::text, new.id::text);
begin
  if new.entity_type <> 'learning_sessions' then
    return new;
  end if;

  if activity = 'book_completion' then
    perform public.award_personal_gamification_bonus(
      new.user_id,
      'milestone_bonus:book:' || source_id,
      10,
      'Bono de hito: libro terminado (+10 adicionales)',
      'first_book_finished',
      'Primer libro terminado',
      'Terminaste un libro y registraste tu primer gran hito de lectura.'
    );
  elsif activity = 'game_completion' then
    perform public.award_personal_gamification_bonus(
      new.user_id,
      'milestone_bonus:game:' || source_id,
      10,
      'Bono de hito: videojuego terminado (+10 adicionales)',
      'first_game_finished',
      'Primer videojuego terminado',
      'Llevaste un videojuego hasta el final.'
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists zz_learning_completion_bonus on public.life_events;
create trigger zz_learning_completion_bonus
after insert on public.life_events
for each row execute function public.award_learning_completion_bonus();

revoke all on function public.award_learning_completion_bonus() from public, anon, authenticated;

-- Premios de nivel de idioma, día bíblico y meta de agua simple.
-- 5) Subir el nivel de un idioma (CEFR) otorga +20 XP una sola vez por
--    cada nuevo nivel alcanzado en ese perfil. Bajar y volver a subir
--    no permite reclamar el mismo nivel dos veces.
create or replace function public.award_language_level_up()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  old_rank integer;
  new_rank integer;
begin
  old_rank := case upper(coalesce(old.level, ''))
    when 'A1' then 1 when 'A2' then 2 when 'B1' then 3
    when 'B2' then 4 when 'C1' then 5 when 'C2' then 6 else 0 end;
  new_rank := case upper(coalesce(new.level, ''))
    when 'A1' then 1 when 'A2' then 2 when 'B1' then 3
    when 'B2' then 4 when 'C1' then 5 when 'C2' then 6 else 0 end;

  if new_rank > old_rank then
    perform public.award_personal_gamification_bonus(
      new.user_id,
      'language_levelup:' || new.id::text || ':' || upper(new.level),
      20,
      'Subiste al nivel ' || upper(new.level) || ' en ' || coalesce(new.language_name, 'un idioma'),
      'first_language_levelup',
      'Primer nivel de idioma alcanzado',
      'Subiste de nivel en uno de los idiomas que estás aprendiendo.'
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists language_level_up_xp on public.language_profiles;
create trigger language_level_up_xp
after update of level on public.language_profiles
for each row execute function public.award_language_level_up();

revoke all on function public.award_language_level_up() from public, anon, authenticated;

-- 6) Las tres casillas diarias del Plan Bíblico: +15 XP, una vez por día
--    de lectura y ciclo, incluso si se desmarca y se vuelve a marcar.
create or replace function public.award_bible_day_completion()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  was_complete boolean := false;
begin
  if tg_op = 'UPDATE' then
    was_complete := coalesce(old.first_done, false)
      and coalesce(old.second_done, false)
      and coalesce(old.third_done, false);
  end if;

  if not (coalesce(new.first_done, false)
      and coalesce(new.second_done, false)
      and coalesce(new.third_done, false))
     or was_complete then
    return new;
  end if;

  perform public.award_personal_gamification_bonus(
    new.user_id,
    'bible_day:' || new.cycle_id::text || ':' || new.day_number::text,
    15,
    'Completaste las tres lecturas del Plan Bíblico',
    'first_bible_day',
    'Primer día bíblico completo',
    'Completaste las tres lecturas del Plan Bíblico en un mismo día.'
  );

  return new;
end;
$function$;

drop trigger if exists bible_day_completion_xp on public.bible_reading_day_progress;
create trigger bible_day_completion_xp
after insert or update on public.bible_reading_day_progress
for each row execute function public.award_bible_day_completion();

revoke all on function public.award_bible_day_completion() from public, anon, authenticated;

-- 7) +10 XP al alcanzar 2.000 ml de agua simple en un mismo día.
--    Solo beverage_type='water' cuenta. Té, café, Frutiño y aguapanela
--    se registran como líquidos, pero no completan este objetivo.
--    Se suma también el agua de medicamentos y el dato legacy de agua
--    si existen, igual que en el resumen de Hidratación de la aplicación.
create or replace function public.award_daily_plain_water_goal()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  target_user uuid;
  target_day date;
  plain_water_ml integer := 0;
begin
  if tg_table_name = 'hydration_entries' then
    target_user := new.user_id;
    target_day := new.consumed_on;
  elsif tg_table_name = 'health_metrics' then
    target_user := new.user_id;
    target_day := new.metric_date;
  elsif tg_table_name = 'medication_doses' then
    target_user := new.user_id;
    target_day := new.dose_date;
  else
    return new;
  end if;

  if target_user is null or target_day is null then
    return new;
  end if;

  select coalesce(sum(amount_ml), 0)::integer
    into plain_water_ml
    from public.hydration_entries
   where user_id = target_user
     and consumed_on = target_day
     and beverage_type = 'water';

  select plain_water_ml + round(coalesce(sum(water_liters), 0) * 1000)::integer
    into plain_water_ml
    from public.health_metrics
   where user_id = target_user
     and metric_date = target_day;

  select plain_water_ml + round(coalesce(sum(water_glasses), 0) * 325)::integer
    into plain_water_ml
    from public.medication_doses
   where user_id = target_user
     and dose_date = target_day
     and status = 'taken';

  if plain_water_ml >= 2000 then
    perform public.award_personal_gamification_bonus(
      target_user,
      'plain_water_goal:' || target_day::text,
      10,
      'Alcanzaste 2.000 ml de agua simple',
      'first_water_goal',
      'Meta de agua alcanzada',
      'Registraste al menos 2 litros de agua simple en un día.'
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists hydration_plain_water_goal_xp on public.hydration_entries;
create trigger hydration_plain_water_goal_xp
after insert or update on public.hydration_entries
for each row execute function public.award_daily_plain_water_goal();

drop trigger if exists health_metrics_plain_water_goal_xp on public.health_metrics;
create trigger health_metrics_plain_water_goal_xp
after insert or update on public.health_metrics
for each row execute function public.award_daily_plain_water_goal();

drop trigger if exists medication_plain_water_goal_xp on public.medication_doses;
create trigger medication_plain_water_goal_xp
after insert or update on public.medication_doses
for each row execute function public.award_daily_plain_water_goal();

revoke all on function public.award_daily_plain_water_goal() from public, anon, authenticated;


-- 8) Seed the new locked trophies for existing POS users, so the cabinet
--    shows future goals as well as the trophies that have already been earned.
insert into public.gamification_achievements(user_id, code, title, description, xp_reward)
select u.id, trophy.code, trophy.title, trophy.description, 0
  from auth.users u
 cross join (values
   ('first_book_finished', 'Primer libro terminado', 'Terminaste un libro y registraste tu primer gran hito de lectura.'),
   ('first_game_finished', 'Primer videojuego terminado', 'Llevaste un videojuego hasta el final.'),
   ('first_language_levelup', 'Primer nivel de idioma alcanzado', 'Subiste de nivel en uno de los idiomas que estás aprendiendo.'),
   ('first_bible_day', 'Primer día bíblico completo', 'Completaste las tres lecturas del Plan Bíblico en un mismo día.'),
   ('first_water_goal', 'Meta de agua alcanzada', 'Registraste al menos 2 litros de agua simple en un día.')
 ) as trophy(code, title, description)
on conflict (user_id, code) do update
   set title = excluded.title,
       description = excluded.description,
       xp_reward = 0;

create or replace function public.backfill_historical_gamification_xp()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_new_xp integer := 0;
begin
  drop table if exists pg_temp.xp_hist_actions;
  drop table if exists pg_temp.xp_hist_bonuses;
  drop table if exists pg_temp.xp_hist_inserted;
  drop table if exists pg_temp.xp_hist_action_summary;
  drop table if exists pg_temp.xp_hist_achievement_criteria;

  create temporary table xp_hist_actions (
    user_id uuid not null,
    entity_type text not null,
    entity_id uuid not null,
    action_date date not null,
    xp integer not null,
    reason text not null,
    payload jsonb not null,
    primary key (user_id, entity_type, entity_id)
  ) on commit drop;

  create temporary table xp_hist_bonuses (
    user_id uuid not null,
    event_key text not null,
    xp integer not null,
    reason text not null,
    event_date date not null,
    trophy_code text,
    trophy_title text,
    trophy_description text,
    primary key (user_id, event_key)
  ) on commit drop;

  create temporary table xp_hist_inserted (
    user_id uuid not null,
    xp integer not null
  ) on commit drop;

  -- 1) Recopilar registros históricos con las mismas reglas de la función XP
  --    vigente. Los eventos ya premiados para la misma fila se excluyen.
  insert into pg_temp.xp_hist_actions(
    user_id, entity_type, entity_id, action_date, xp, reason, payload
  )
  select
    src.user_id,
    src.entity_type,
    src.entity_id,
    least(src.action_date, v_today),
    scoring.xp,
    'Histórico · ' || src.reason,
    src.payload
  from (
    select
      hlog.user_id,
      'habit_logs'::text as entity_type,
      hlog.id as entity_id,
      hlog.date as action_date,
      'Completaste un hábito.'::text as reason,
      to_jsonb(hlog) || jsonb_build_object(
        '_operation', 'INSERT',
        'habit_kind', coalesce(h.kind, 'habit')
      ) as payload
    from public.habit_logs hlog
    left join public.habits h
      on h.id = hlog.habit_id
     and h.user_id = hlog.user_id

    union all

    select
      rlog.user_id,
      'routine_logs',
      rlog.id,
      rlog.log_date,
      'Completaste una rutina.',
      to_jsonb(rlog) || jsonb_build_object('_operation', 'INSERT')
    from public.routine_logs rlog
    where rlog.completed = true

    union all

    select
      j.user_id,
      'journal_entries',
      j.id,
      j.entry_date,
      'Registraste una entrada en el diario.',
      to_jsonb(j) || jsonb_build_object('_operation', 'INSERT')
    from public.journal_entries j

    union all

    select
      wi.user_id,
      'work_items',
      wi.id,
      (wi.created_at at time zone 'America/Bogota')::date,
      'Registraste una acción de trabajo.',
      to_jsonb(wi) || jsonb_build_object('_operation', 'INSERT')
    from public.work_items wi

    union all

    select
      ws.user_id,
      'work_sessions',
      ws.id,
      ws.session_date,
      'Completaste una sesión de trabajo.',
      to_jsonb(ws) || jsonb_build_object('_operation', 'UPDATE')
    from public.work_sessions ws
    where coalesce(to_jsonb(ws)->>'status', '') = 'completed'

    union all

    select
      hm.user_id,
      'health_metrics',
      hm.id,
      hm.metric_date,
      'Registraste una medición de salud.',
      to_jsonb(hm) || jsonb_build_object('_operation', 'INSERT')
    from public.health_metrics hm

    union all

    select
      ft.user_id,
      'finance_transactions',
      ft.id,
      ft.occurred_on,
      'Registraste una transacción financiera.',
      to_jsonb(ft) || jsonb_build_object('_operation', 'INSERT')
    from public.finance_transactions ft

    union all

    select
      ls.user_id,
      'learning_sessions',
      ls.id,
      ls.session_date,
      'Registraste una sesión de aprendizaje.',
      to_jsonb(ls) || jsonb_build_object('_operation', 'INSERT')
    from public.learning_sessions ls

    union all

    select
      ri.user_id,
      'relationship_interactions',
      ri.id,
      ri.interaction_on,
      'Registraste una interacción en Relaciones.',
      to_jsonb(ri) || jsonb_build_object('_operation', 'INSERT')
    from public.relationship_interactions ri

    union all

    select
      se.user_id,
      'spiritual_entries',
      se.id,
      se.entry_date,
      'Registraste una práctica o reflexión espiritual.',
      to_jsonb(se) || jsonb_build_object('_operation', 'INSERT')
    from public.spiritual_entries se

    union all

    select
      lg.user_id,
      'life_goals',
      lg.id,
      (lg.created_at at time zone 'America/Bogota')::date,
      'Registraste una meta personal.',
      to_jsonb(lg) || jsonb_build_object('_operation', 'INSERT')
    from public.life_goals lg

    union all

    select
      pi.user_id,
      'planner_items',
      pi.id,
      (coalesce(pi.completed_at, pi.updated_at, pi.created_at)
        at time zone 'America/Bogota')::date,
      'Completaste una tarea o compromiso del Planeador.',
      to_jsonb(pi) || jsonb_build_object(
        '_operation', 'UPDATE',
        '_completion_event', true
      )
    from public.planner_items pi
    where pi.status::text = 'done'
  ) src
  cross join lateral (
    select public.gamification_xp_for_event(src.entity_type, src.payload) as xp
  ) scoring
  where scoring.xp > 0
    and not exists (
      select 1
      from public.gamification_xp_events ge
      left join public.life_events le
        on le.id = ge.life_event_id
      where ge.user_id = src.user_id
        and ge.xp > 0
        and (
          ge.event_key = 'record:' || src.entity_type || ':' || src.entity_id::text
          or (
            le.entity_type = src.entity_type
            and le.entity_id = src.entity_id
          )
        )
    )
  on conflict (user_id, entity_type, entity_id) do nothing;

  -- 2) Crear eventos históricos sintéticos para poder vincular cada punto
  --    a su registro original. Se desactivan temporalmente solo los dos
  --    triggers que repartirían XP/bonos usando la fecha de hoy.
  alter table public.life_events disable trigger gamification_from_life_event;
  alter table public.life_events disable trigger zz_learning_completion_bonus;

  insert into public.life_events(
    user_id, event_key, event_type, entity_type, entity_id, event_at, payload, created_at
  )
  select
    a.user_id,
    'xp-backfill:' || a.entity_type || ':' || a.entity_id::text,
    'recorded',
    a.entity_type,
    a.entity_id,
    ((a.action_date::timestamp + interval '12 hours') at time zone 'America/Bogota'),
    a.payload || jsonb_build_object('_xp_backfill', true),
    ((a.action_date::timestamp + interval '12 hours') at time zone 'America/Bogota')
  from pg_temp.xp_hist_actions a
  on conflict (user_id, event_key) do nothing;

  alter table public.life_events enable trigger gamification_from_life_event;
  alter table public.life_events enable trigger zz_learning_completion_bonus;

  -- 3) Insertar el XP base con la clave estable que utiliza POS hoy.
  --    Un eventual registro previo con 0 XP se corrige; uno ya premiado no cambia.
  with inserted as (
    insert into public.gamification_xp_events as current_event(
      user_id, life_event_id, event_key, xp, reason, created_at
    )
    select
      a.user_id,
      le.id,
      'record:' || a.entity_type || ':' || a.entity_id::text,
      a.xp,
      a.reason,
      ((a.action_date::timestamp + interval '12 hours') at time zone 'America/Bogota')
    from pg_temp.xp_hist_actions a
    join public.life_events le
      on le.user_id = a.user_id
     and le.event_key = 'xp-backfill:' || a.entity_type || ':' || a.entity_id::text
    on conflict (user_id, event_key) do update
      set life_event_id = coalesce(current_event.life_event_id, excluded.life_event_id),
          xp = excluded.xp,
          reason = excluded.reason,
          created_at = excluded.created_at
      where current_event.xp <= 0
    returning user_id, xp
  )
  insert into pg_temp.xp_hist_inserted(user_id, xp)
  select user_id, xp from inserted;

  -- 4) Bonos retroactivos de hitos que ya tienen una fuente histórica.
  --    Un libro/juego terminado con sesión de finalización recibe el bono
  --    adicional de +10. Si el elemento figura terminado pero nunca tuvo esa
  --    sesión, se acreditan juntos los +10 base y los +10 de hito (+20).
  insert into pg_temp.xp_hist_bonuses(
    user_id, event_key, xp, reason, event_date,
    trophy_code, trophy_title, trophy_description
  )
  select distinct on (ls.user_id, coalesce(ls.learning_item_id, ls.id))
    ls.user_id,
    'milestone_bonus:book:' || coalesce(ls.learning_item_id, ls.id)::text,
    10,
    'Bono histórico · libro terminado: ' || coalesce(li.title, 'Libro') || ' (+10 XP)',
    least(ls.session_date, v_today),
    'first_book_finished',
    'Primer libro terminado',
    'Terminaste un libro y registraste tu primer gran hito de lectura.'
  from public.learning_sessions ls
  left join public.learning_items li
    on li.id = ls.learning_item_id
   and li.user_id = ls.user_id
  where ls.activity_type = 'book_completion'
  order by ls.user_id, coalesce(ls.learning_item_id, ls.id), ls.session_date, ls.created_at
  on conflict (user_id, event_key) do nothing;

  insert into pg_temp.xp_hist_bonuses(
    user_id, event_key, xp, reason, event_date,
    trophy_code, trophy_title, trophy_description
  )
  select distinct on (ls.user_id, coalesce(ls.learning_item_id, ls.id))
    ls.user_id,
    'milestone_bonus:game:' || coalesce(ls.learning_item_id, ls.id)::text,
    10,
    'Bono histórico · videojuego terminado: ' || coalesce(li.title, 'Videojuego') || ' (+10 XP)',
    least(ls.session_date, v_today),
    'first_game_finished',
    'Primer videojuego terminado',
    'Llevaste un videojuego hasta el final.'
  from public.learning_sessions ls
  left join public.learning_items li
    on li.id = ls.learning_item_id
   and li.user_id = ls.user_id
  where ls.activity_type = 'game_completion'
  order by ls.user_id, coalesce(ls.learning_item_id, ls.id), ls.session_date, ls.created_at
  on conflict (user_id, event_key) do nothing;

  -- Libros terminados anteriores a la opción de reclamar XP.
  insert into pg_temp.xp_hist_bonuses(
    user_id, event_key, xp, reason, event_date,
    trophy_code, trophy_title, trophy_description
  )
  select
    li.user_id,
    'milestone_bonus:book:' || li.id::text,
    20,
    'Hito histórico · libro terminado: ' || li.title || ' (+20 XP)',
    least(coalesce(li.completed_on, (li.updated_at at time zone 'America/Bogota')::date), v_today),
    'first_book_finished',
    'Primer libro terminado',
    'Terminaste un libro y registraste tu primer gran hito de lectura.'
  from public.learning_items li
  where li.kind = 'book'
    and li.status = 'completed'
    and not exists (
      select 1
      from public.learning_sessions ls
      where ls.user_id = li.user_id
        and ls.learning_item_id = li.id
        and ls.activity_type = 'book_completion'
    )
  on conflict (user_id, event_key) do nothing;

  -- Videojuegos terminados antes de que existiera el registro de finalización.
  insert into pg_temp.xp_hist_bonuses(
    user_id, event_key, xp, reason, event_date,
    trophy_code, trophy_title, trophy_description
  )
  select
    li.user_id,
    'milestone_bonus:game:' || li.id::text,
    20,
    'Hito histórico · videojuego terminado: ' || li.title || ' (+20 XP)',
    least(coalesce(li.completed_on, (li.updated_at at time zone 'America/Bogota')::date), v_today),
    'first_game_finished',
    'Primer videojuego terminado',
    'Llevaste un videojuego hasta el final.'
  from public.learning_items li
  where li.kind in ('video_game', 'game')
    and li.status = 'completed'
    and not exists (
      select 1
      from public.learning_sessions ls
      where ls.user_id = li.user_id
        and ls.learning_item_id = li.id
        and ls.activity_type = 'game_completion'
    )
  on conflict (user_id, event_key) do nothing;

  -- POS conserva el nivel actual del idioma, no todos los cambios anteriores.
  -- Se reconoce una vez el nivel vigente si es superior a A1.
  insert into pg_temp.xp_hist_bonuses(
    user_id, event_key, xp, reason, event_date,
    trophy_code, trophy_title, trophy_description
  )
  select
    lp.user_id,
    'language_levelup:' || lp.id::text || ':' || upper(lp.level),
    20,
    'Hito histórico · nivel ' || upper(lp.level) || ' en ' || lp.language_name,
    least((coalesce(lp.updated_at, lp.created_at) at time zone 'America/Bogota')::date, v_today),
    'first_language_levelup',
    'Primer nivel de idioma alcanzado',
    'Subiste de nivel en uno de los idiomas que estás aprendiendo.'
  from public.language_profiles lp
  where case upper(coalesce(lp.level, ''))
    when 'A2' then 2 when 'B1' then 3 when 'B2' then 4
    when 'C1' then 5 when 'C2' then 6 else 0
  end > 1
  on conflict (user_id, event_key) do nothing;

  -- Los días bíblicos ya completos (incluidos los días antiguos migrados desde
  -- bible_reading_completions) reciben +15 XP una sola vez por ciclo y día.
  insert into pg_temp.xp_hist_bonuses(
    user_id, event_key, xp, reason, event_date,
    trophy_code, trophy_title, trophy_description
  )
  select
    bp.user_id,
    'bible_day:' || bp.cycle_id::text || ':' || bp.day_number::text,
    15,
    'Hito histórico · completaste las tres lecturas del día bíblico ' || bp.day_number,
    least((coalesce(bp.completed_at, bp.updated_at) at time zone 'America/Bogota')::date, v_today),
    'first_bible_day',
    'Primer día bíblico completo',
    'Completaste las tres lecturas del Plan Bíblico en un mismo día.'
  from public.bible_reading_day_progress bp
  where bp.first_done = true
    and bp.second_done = true
    and bp.third_done = true
  on conflict (user_id, event_key) do nothing;

  -- Recuperar metas antiguas de 2.000 ml de agua simple. Se suman las mismas
  -- fuentes que utiliza el resumen actual de Hidratación.
  insert into pg_temp.xp_hist_bonuses(
    user_id, event_key, xp, reason, event_date,
    trophy_code, trophy_title, trophy_description
  )
  with water_rows as (
    select
      he.user_id,
      he.consumed_on as water_date,
      sum(he.amount_ml)::numeric as water_ml
    from public.hydration_entries he
    where he.beverage_type = 'water'
    group by he.user_id, he.consumed_on

    union all

    select
      hm.user_id,
      hm.metric_date,
      sum(coalesce(hm.water_liters, 0) * 1000)::numeric
    from public.health_metrics hm
    where coalesce(hm.water_liters, 0) > 0
    group by hm.user_id, hm.metric_date

    union all

    select
      md.user_id,
      md.dose_date,
      sum(coalesce(md.water_glasses, 0) * 325)::numeric
    from public.medication_doses md
    where md.status = 'taken'
      and coalesce(md.water_glasses, 0) > 0
    group by md.user_id, md.dose_date
  ),
  daily_water as (
    select user_id, water_date, sum(water_ml)::integer as total_ml
    from water_rows
    group by user_id, water_date
    having sum(water_ml) >= 2000
  )
  select
    dw.user_id,
    'plain_water_goal:' || dw.water_date::text,
    10,
    'Hito histórico · alcanzaste 2.000 ml de agua simple',
    least(dw.water_date, v_today),
    'first_water_goal',
    'Meta de agua alcanzada',
    'Registraste al menos 2 litros de agua simple en un día.'
  from daily_water dw
  on conflict (user_id, event_key) do nothing;

  -- Acreditar los bonos. No se actualizan retos: sus fechas corresponden al
  -- período en que fueron creados, no al historial anterior.
  with inserted as (
    insert into public.gamification_xp_events as current_event(
      user_id, life_event_id, event_key, xp, reason, created_at
    )
    select
      b.user_id,
      null,
      b.event_key,
      b.xp,
      b.reason,
      ((b.event_date::timestamp + interval '12 hours') at time zone 'America/Bogota')
    from pg_temp.xp_hist_bonuses b
    on conflict (user_id, event_key) do update
      set xp = excluded.xp,
          reason = excluded.reason,
          created_at = excluded.created_at
      where current_event.xp <= 0
    returning user_id, xp
  )
  insert into pg_temp.xp_hist_inserted(user_id, xp)
  select user_id, xp from inserted;

  -- Desbloquear los trofeos especiales que el historial demuestra.
  insert into public.gamification_achievements(
    user_id, code, title, description, xp_reward, unlocked_at
  )
  select distinct
    b.user_id,
    b.trophy_code,
    b.trophy_title,
    b.trophy_description,
    0,
    ((b.event_date::timestamp + interval '12 hours') at time zone 'America/Bogota')
  from pg_temp.xp_hist_bonuses b
  where b.trophy_code is not null
  on conflict (user_id, code) do update
    set unlocked_at = coalesce(
      public.gamification_achievements.unlocked_at,
      excluded.unlocked_at
    );

  -- 5) Calcular logros históricos a partir de acciones reales, no de bonos.
  create temporary table xp_hist_action_summary on commit drop as
  with source_action_events as (
    select
      ge.user_id,
      le.entity_type,
      le.entity_id,
      least(
        coalesce(
          case le.entity_type
            when 'habit_logs' then nullif(le.payload->>'date', '')::date
            when 'routine_logs' then nullif(le.payload->>'log_date', '')::date
            when 'journal_entries' then nullif(le.payload->>'entry_date', '')::date
            when 'finance_transactions' then nullif(le.payload->>'occurred_on', '')::date
            when 'health_metrics' then nullif(le.payload->>'metric_date', '')::date
            when 'learning_sessions' then nullif(le.payload->>'session_date', '')::date
            when 'relationship_interactions' then nullif(le.payload->>'interaction_on', '')::date
            when 'spiritual_entries' then nullif(le.payload->>'entry_date', '')::date
            when 'work_sessions' then nullif(le.payload->>'session_date', '')::date
            else null
          end,
          (le.event_at at time zone 'America/Bogota')::date
        ),
        v_today
      ) as action_date
    from public.gamification_xp_events ge
    join public.life_events le on le.id = ge.life_event_id
    where ge.user_id is not null
      and ge.xp > 0
      and ge.event_key not like 'achievement:%'
      and le.entity_id is not null
      and le.entity_type in (
        'habit_logs', 'routine_logs', 'journal_entries', 'work_items',
        'work_sessions', 'health_metrics', 'finance_transactions',
        'learning_sessions', 'relationship_interactions', 'spiritual_entries',
        'life_goals', 'planner_items'
      )
  ),
  source_actions as (
    select user_id, entity_type, entity_id, min(action_date) as action_date
    from source_action_events
    group by user_id, entity_type, entity_id
  ),
  ranked_actions as (
    select
      sa.*,
      row_number() over (
        partition by sa.user_id
        order by sa.action_date, sa.entity_type, sa.entity_id
      ) as action_number
    from source_actions sa
  ),
  distinct_days as (
    select distinct user_id, action_date
    from source_actions
  ),
  ranked_days as (
    select
      dd.user_id,
      dd.action_date,
      dd.action_date - row_number() over (
        partition by dd.user_id order by dd.action_date
      )::integer as streak_group
    from distinct_days dd
  ),
  streak_groups as (
    select
      rd.user_id,
      min(rd.action_date) as start_on,
      max(rd.action_date) as end_on,
      count(*)::integer as day_count
    from ranked_days rd
    group by rd.user_id, rd.streak_group
  ),
  streak_summary as (
    select
      sg.user_id,
      max(sg.day_count)::integer as best_streak,
      max(sg.end_on) as last_activity_on,
      coalesce(max(sg.day_count) filter (where sg.end_on >= v_today - 1), 0)::integer as current_streak,
      min(sg.start_on + 6) filter (where sg.day_count >= 7) as seven_day_on
    from streak_groups sg
    group by sg.user_id
  )
  select
    ra.user_id,
    count(*)::integer as action_count,
    min(ra.action_date) as first_action_on,
    min(ra.action_date) filter (where ra.action_number = 10) as ten_actions_on,
    min(ra.action_date) filter (where ra.entity_type = 'relationship_interactions') as first_relationship_on,
    min(ra.action_date) filter (where ra.entity_type = 'spiritual_entries') as first_spiritual_on,
    min(ra.action_date) filter (where ra.entity_type = 'learning_sessions') as first_learning_on,
    min(ra.action_date) filter (where ra.entity_type = 'work_sessions') as first_work_on,
    max(ss.best_streak)::integer as best_streak,
    max(ss.current_streak)::integer as current_streak,
    max(ss.last_activity_on) as last_activity_on,
    max(ss.seven_day_on) as seven_day_on
  from ranked_actions ra
  left join streak_summary ss on ss.user_id = ra.user_id
  group by ra.user_id;

  create temporary table xp_hist_achievement_criteria (
    user_id uuid not null,
    code text not null,
    title text not null,
    description text not null,
    xp_reward integer not null,
    unlocked_on date not null,
    primary key (user_id, code)
  ) on commit drop;

  insert into pg_temp.xp_hist_achievement_criteria(
    user_id, code, title, description, xp_reward, unlocked_on
  )
  select
    s.user_id,
    m.code,
    m.title,
    m.description,
    m.xp_reward,
    m.unlocked_on
  from pg_temp.xp_hist_action_summary s
  cross join lateral (
    values
      (
        'first_action'::text,
        'Primera acción'::text,
        'Registraste tu primera acción en Personal OS.'::text,
        10,
        s.first_action_on
      ),
      (
        'ten_actions',
        'Diez acciones',
        'Registraste diez acciones reales.',
        25,
        s.ten_actions_on
      ),
      (
        'seven_day_streak',
        'Siete días',
        'Mantuviste actividad durante siete días consecutivos.',
        30,
        s.seven_day_on
      ),
      (
        'first_relationship',
        'Primera relación cuidada',
        'Registraste tu primera interacción con una relación.',
        15,
        s.first_relationship_on
      ),
      (
        'first_spiritual_entry',
        'Primer registro espiritual',
        'Registraste tu primera entrada espiritual.',
        15,
        s.first_spiritual_on
      ),
      (
        'first_learning_session',
        'Primer aprendizaje',
        'Registraste tu primera sesión de aprendizaje.',
        15,
        s.first_learning_on
      ),
      (
        'first_work_session',
        'Primer bloque de trabajo',
        'Registraste tu primera sesión de trabajo.',
        15,
        s.first_work_on
      )
  ) as m(code, title, description, xp_reward, unlocked_on)
  where m.unlocked_on is not null;

  insert into public.gamification_achievements(
    user_id, code, title, description, xp_reward, unlocked_at
  )
  select
    c.user_id,
    c.code,
    c.title,
    c.description,
    c.xp_reward,
    ((c.unlocked_on::timestamp + interval '12 hours') at time zone 'America/Bogota')
  from pg_temp.xp_hist_achievement_criteria c
  on conflict (user_id, code) do update
    set unlocked_at = coalesce(
      public.gamification_achievements.unlocked_at,
      excluded.unlocked_at
    );

  with inserted as (
    insert into public.gamification_xp_events(
      user_id, life_event_id, event_key, xp, reason, created_at
    )
    select
      ga.user_id,
      null,
      'achievement:' || ga.code,
      ga.xp_reward,
      'Logro desbloqueado: ' || ga.title,
      ga.unlocked_at
    from public.gamification_achievements ga
    join pg_temp.xp_hist_achievement_criteria c
      on c.user_id = ga.user_id
     and c.code = ga.code
    where ga.xp_reward > 0
      and ga.unlocked_at is not null
    on conflict (user_id, event_key) do nothing
    returning user_id, xp
  )
  insert into pg_temp.xp_hist_inserted(user_id, xp)
  select user_id, xp from inserted;

  -- 6) Reconciliar el total sin reducir XP previo. El trigger de perfiles
  --    calcula automáticamente los niveles de 200 XP.
  insert into public.gamification_profiles(user_id, xp, level)
  select ge.user_id, least(sum(greatest(ge.xp, 0)::bigint), 2147483647)::integer, 1
  from public.gamification_xp_events ge
  group by ge.user_id
  on conflict (user_id) do update
    set xp = greatest(public.gamification_profiles.xp, excluded.xp),
        updated_at = now();

  -- Las rachas sí se reconstruyen usando las fechas históricas de actividad.
  update public.gamification_profiles gp
  set current_streak = coalesce(s.current_streak, 0),
      best_streak = greatest(gp.best_streak, coalesce(s.best_streak, 0)),
      last_activity_on = s.last_activity_on,
      updated_at = now()
  from pg_temp.xp_hist_action_summary s
  where gp.user_id = s.user_id;

  select coalesce(sum(i.xp), 0)::integer
    into v_new_xp
  from pg_temp.xp_hist_inserted i;

  return v_new_xp;
end;
$function$;

revoke all on function public.backfill_historical_gamification_xp()
  from public, anon, authenticated;

do $backfill$
declare
  awarded_xp integer;
begin
  awarded_xp := public.backfill_historical_gamification_xp();
  raise notice 'Historical gamification backfill credited % new XP.', awarded_xp;
end;
$backfill$;

commit;
