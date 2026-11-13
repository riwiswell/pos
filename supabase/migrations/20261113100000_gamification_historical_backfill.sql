-- POS · Reconocimiento retroactivo de XP para el historial existente
-- Cada registro elegible se acredita una sola vez mediante claves estables.
-- La migración conserva las reglas actuales de XP, no altera los registros
-- originales y no avanza retos que pertenecen a períodos anteriores.
--
-- Incluye: hábitos (no actividades), rutinas completadas, diario, trabajo,
-- salud, finanzas, aprendizaje, relaciones, espiritualidad, metas y tareas
-- completadas del Planeador.
-- También recupera hitos históricos: libros/juegos terminados, nivel actual
-- de idioma, días bíblicos completos y metas diarias de agua simple.
--
-- No otorga XP por tomas de medicamentos, registros menstruales ni citas:
-- esas fuentes no tienen actualmente una regla de XP en POS.
--
-- El nivel de idioma actual permite acreditar un único hito por perfil;
-- POS no conserva un historial de cada cambio de nivel.
--
-- Este procedimiento puede volver a ejecutarse sin duplicar puntos.

begin;

-- Esta función también se define aquí porque el SQL Editor de Lovable puede
-- no haber aplicado todavía la migración anterior del Planeador.
-- Mantiene exactamente las reglas de XP usadas por POS.
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
