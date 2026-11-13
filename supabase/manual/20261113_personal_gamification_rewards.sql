-- POS · Recompensas de hitos, Plan Bíblico, agua y niveles de 200 XP
-- Ejecutar UNA SOLA VEZ en el SQL Editor del proyecto Supabase que usa POS:
-- https://eutrhjvdyrakrxmjemut.supabase.co
-- No ejecutar en otro proyecto llamado POS ni en una base de pruebas.
--
-- Esta migración:
--   * fija los niveles en tramos de 200 XP;
--   * añade +10 XP a cada recompensa de libro previamente reclamada (+20 total);
--   * añade +10 de bono a terminar libros/videojuegos (20 XP incluyendo el registro base);
--   * da +20 XP al subir de nivel CEFR (A1 a A2 ... C1 a C2);
--   * da +15 XP al completar las tres lecturas de un día bíblico;
--   * da +10 XP al alcanzar 2.000 ml de agua simple en un día;
--   * registra trofeos de esos hitos.
--
-- Los registros de juego/lectura/idioma siguen usando learning_sessions.
-- Las recompensas directas son idempotentes por event_key.

begin;

-- 1) Todas las rutas que actualizan un perfil convergen en el umbral nuevo.
create or replace function public.sync_gamification_level_200()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.level := greatest(1, floor(greatest(0, coalesce(new.xp, 0)) / 200.0)::integer + 1);
  return new;
end;
$function$;

drop trigger if exists gamification_profiles_level_200 on public.gamification_profiles;
create trigger gamification_profiles_level_200
before insert or update on public.gamification_profiles
for each row execute function public.sync_gamification_level_200();

update public.gamification_profiles
   set level = greatest(1, floor(greatest(0, coalesce(xp, 0)) / 200.0)::integer + 1);

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
  source_id text := coalesce(new.entity_id::text, new.id::text);
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

-- 4) Regulariza libros cuyo bono anterior fue reclamado con 10 XP.
--    Solo se suma el complemento si ya existe el evento base de +10 XP.
do $function$
declare
  completion record;
begin
  for completion in
    select ls.user_id, ls.id as session_id
      from public.learning_sessions ls
      join public.life_events le
        on le.user_id = ls.user_id
       and le.entity_type = 'learning_sessions'
       and le.entity_id = ls.id
      join public.gamification_xp_events base_xp
        on base_xp.user_id = ls.user_id
       and base_xp.life_event_id = le.id
       and base_xp.event_key = 'record:learning_sessions:' || ls.id::text
       and base_xp.xp > 0
     where ls.activity_type = 'book_completion'
       and not exists (
         select 1
           from public.gamification_xp_events bonus
          where bonus.user_id = ls.user_id
            and bonus.event_key = 'milestone_bonus:book:' || ls.id::text
       )
  loop
    perform public.award_personal_gamification_bonus(
      completion.user_id,
      'milestone_bonus:book:' || completion.session_id::text,
      10,
      'Bono de hito: libro terminado (+10 adicionales)',
      'first_book_finished',
      'Primer libro terminado',
      'Terminaste un libro y registraste tu primer gran hito de lectura.'
    );
  end loop;
end;
$function$;

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

commit;

-- Verificación posterior:
-- select xp, level from public.gamification_profiles;
-- select event_key, xp, reason, created_at
--   from public.gamification_xp_events
--  where event_key like 'milestone_bonus:book:%'
--     or event_key like 'bible_day:%'
--     or event_key like 'plain_water_goal:%'
--  order by created_at desc;
