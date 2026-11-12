-- POS / Personal OS
-- Recuperación del historial documentado de octubre + reconstrucción estimada
-- del consumo de Bilaxten, Diosmina/Hesperidina y Losartán según existencias.
--
-- Ejecutar una sola vez o varias: es idempotente.
-- Los registros reconstruidos quedan identificados por entry_origin:
--   restored_snapshot = restaurado desde la captura previa al borrado
--   stock_estimate     = estimado desde el saldo físico de la caja
-- No se borra ningún registro ni se altera el historial manual ya existente.
--
-- Supuestos confirmados por Ricardo:
--   Cajas: 30 unidades por medicamento.
--   Bilaxten: quedan 19 (11 consumidas).
--   Diosmina/Hesperidina: quedan 12 (18 consumidas; 2 tomas/día).
--   Losartán: el saldo calculado era 3 (27 consumidas; 8 ya estaban registradas).
-- Los días reconstruidos por inventario se distribuyen hacia atrás desde 2026-11-11
-- a las horas programadas. No son horas/días reales confirmados; quedan etiquetados
-- como estimación de inventario para diferenciarlos del registro manual.

begin;

alter table public.medication_doses
  add column if not exists entry_origin text not null default 'manual';

-- 1) Comprobar que existen las fichas antiguas y seleccionar el ciclo antiguo de Losartán.
do $$
declare
  v_user uuid;
  v_hioscina uuid;
  v_old_losartan uuid;
  v_nikzon uuid;
  v_rifaximina uuid;
begin
  select id into v_user
  from auth.users
  where lower(email) = lower('riwiswell@gmail.com')
  limit 1;

  if v_user is null then
    raise exception 'No se encontró el usuario de POS.';
  end if;

  select id into v_hioscina
  from public.medications
  where user_id=v_user and lower(name)=lower('Hioscina')
  order by start_date asc
  limit 1;

  select id into v_old_losartan
  from public.medications
  where user_id=v_user
    and lower(name)=lower('Losartán')
    and end_date is not null
    and start_date < date '2026-11-12'
  order by start_date asc
  limit 1;

  select id into v_nikzon
  from public.medications
  where user_id=v_user and lower(name)=lower('Nikzon')
  order by start_date asc
  limit 1;

  select id into v_rifaximina
  from public.medications
  where user_id=v_user and lower(name)=lower('Rifaximina')
  order by start_date asc
  limit 1;

  if v_hioscina is null or v_old_losartan is null
     or v_nikzon is null or v_rifaximina is null then
    raise exception 'No encuentro todas las fichas antiguas (Hioscina, ciclo anterior de Losartán, Nikzon y Rifaximina). No se insertó el historial; revisa los nombres de las fichas.';
  end if;
end $$;

-- 2) Extender el inicio del ciclo histórico de Losartán al primer día que aparece
-- en la captura. No modifica su fecha final ni el ciclo actual de noviembre.
update public.medications m
set start_date = least(m.start_date, date '2026-10-02')
where m.user_id = (select id from auth.users where lower(email)=lower('riwiswell@gmail.com') limit 1)
  and m.id = (
    select id from public.medications
    where user_id=(select id from auth.users where lower(email)=lower('riwiswell@gmail.com') limit 1)
      and lower(name)=lower('Losartán')
      and end_date is not null
      and start_date < date '2026-11-12'
    order by start_date asc limit 1
  );

-- 3) Restaurar los 49 registros que se veían en la captura anterior al borrado.
-- Los estados y horas se copian tal como aparecían; no se convierten pendientes en tomadas.
with u as (
  select id as user_id
  from auth.users
  where lower(email)=lower('riwiswell@gmail.com')
  limit 1
),
m as (
  select
    (select id from public.medications where user_id=u.user_id and lower(name)=lower('Hioscina') order by start_date asc limit 1) as hioscina_id,
    (select id from public.medications where user_id=u.user_id and lower(name)=lower('Losartán') and end_date is not null and start_date < date '2026-11-12' order by start_date asc limit 1) as losartan_id,
    (select id from public.medications where user_id=u.user_id and lower(name)=lower('Nikzon') order by start_date asc limit 1) as nikzon_id,
    (select id from public.medications where user_id=u.user_id and lower(name)=lower('Rifaximina') order by start_date asc limit 1) as rifaximina_id
  from u
),
snapshot(medication_name,dose_date,scheduled_time,status,taken_time,taken_day_offset) as (
  values
    ('Nikzon',     date '2026-10-14','12:00','taken',   '13:16',0),
    ('Nikzon',     date '2026-10-13','12:00','pending', null,   0),
    ('Nikzon',     date '2026-10-12','12:00','pending', null,   0),
    ('Losartán',   date '2026-10-12','10:30','pending', null,   0),
    ('Nikzon',     date '2026-10-11','12:00','pending', null,   0),
    ('Losartán',   date '2026-10-11','10:30','pending', null,   0),
    ('Rifaximina', date '2026-10-10','23:30','pending', null,   0),
    ('Nikzon',     date '2026-10-10','12:00','taken',   '14:18',0),
    ('Rifaximina', date '2026-10-10','11:30','pending', null,   0),
    ('Losartán',   date '2026-10-10','10:30','pending', null,   0),
    ('Rifaximina', date '2026-10-09','23:30','taken',   '00:58',1),
    ('Nikzon',     date '2026-10-09','12:00','pending', null,   0),
    ('Rifaximina', date '2026-10-09','11:30','taken',   '13:02',0),
    ('Losartán',   date '2026-10-09','10:30','taken',   '11:05',0),
    ('Rifaximina', date '2026-10-08','23:30','pending', null,   0),
    ('Nikzon',     date '2026-10-08','12:00','taken',   '13:55',0),
    ('Rifaximina', date '2026-10-08','11:30','taken',   '12:32',0),
    ('Losartán',   date '2026-10-08','10:30','taken',   '11:01',0),
    ('Rifaximina', date '2026-10-07','23:30','taken',   '23:40',0),
    ('Nikzon',     date '2026-10-07','12:00','taken',   '13:55',0),
    ('Rifaximina', date '2026-10-07','11:30','taken',   '12:51',0),
    ('Losartán',   date '2026-10-07','10:30','taken',   '10:30',0),
    ('Rifaximina', date '2026-10-06','23:30','taken',   '00:09',1),
    ('Nikzon',     date '2026-10-06','12:00','taken',   '13:20',0),
    ('Rifaximina', date '2026-10-06','11:30','taken',   '12:40',0),
    ('Losartán',   date '2026-10-06','10:30','taken',   '10:36',0),
    ('Rifaximina', date '2026-10-05','23:30','taken',   '23:35',0),
    ('Nikzon',     date '2026-10-05','12:00','taken',   '13:45',0),
    ('Rifaximina', date '2026-10-05','11:30','taken',   '12:20',0),
    ('Losartán',   date '2026-10-05','10:30','taken',   '10:40',0),
    ('Rifaximina', date '2026-10-04','23:30','taken',   '23:30',0),
    ('Nikzon',     date '2026-10-04','12:00','taken',   '13:40',0),
    ('Rifaximina', date '2026-10-04','11:30','taken',   '13:50',0),
    ('Losartán',   date '2026-10-04','10:30','taken',   '10:36',0),
    ('Rifaximina', date '2026-10-03','23:30','taken',   '23:34',0),
    ('Hioscina',   date '2026-10-03','23:00','taken',   '23:04',0),
    ('Hioscina',   date '2026-10-03','15:00','taken',   '16:29',0),
    ('Nikzon',     date '2026-10-03','12:00','taken',   '16:29',0),
    ('Rifaximina', date '2026-10-03','11:30','taken',   '16:29',0),
    ('Losartán',   date '2026-10-03','10:00','taken',   '16:29',0),
    ('Hioscina',   date '2026-10-03','07:00','taken',   '16:29',0),
    ('Rifaximina', date '2026-10-02','23:30','taken',   '23:38',0),
    ('Hioscina',   date '2026-10-02','23:00','taken',   '23:04',0),
    ('Hioscina',   date '2026-10-02','15:00','skipped', null,   0),
    ('Nikzon',     date '2026-10-02','12:00','taken',   '12:09',0),
    ('Rifaximina', date '2026-10-02','11:30','taken',   '12:11',0),
    ('Losartán',   date '2026-10-02','10:00','taken',   '10:47',0),
    ('Hioscina',   date '2026-10-02','07:00','taken',   '07:35',0),
    ('Rifaximina', date '2026-10-01','23:30','taken',   '23:40',0)
),
mapped as (
  select
    u.user_id,
    case s.medication_name
      when 'Hioscina' then m.hioscina_id
      when 'Losartán' then m.losartan_id
      when 'Nikzon' then m.nikzon_id
      when 'Rifaximina' then m.rifaximina_id
    end as medication_id,
    s.*
  from snapshot s
  cross join u
  cross join m
)
insert into public.medication_doses
  (user_id,medication_id,dose_date,scheduled_time,scheduled_at,status,taken_at,entry_origin)
select
  user_id,
  medication_id,
  dose_date,
  scheduled_time,
  ((dose_date + scheduled_time::time) at time zone 'America/Bogota'),
  status,
  case
    when status <> 'taken' then null
    else (
      (dose_date + taken_day_offset + taken_time::time)
      at time zone 'America/Bogota'
    )
  end,
  'restored_snapshot'
from mapped
on conflict (medication_id,dose_date,scheduled_time) do nothing;

-- 4) Reconstruir el consumo total de las cajas actuales.
-- Se toma el saldo actual del resultado que compartiste:
-- Bilaxten 19, Diosmina 12, Losartán 3 (11 configuradas - 8 tomadas).
-- Para cada medicamento se añaden solo las tomas que faltan para completar
-- 30 unidades consumidas/restantes, sin duplicar registros existentes.
do $$
declare
  v_user uuid;
  v_name text;
  v_med_id uuid;
  v_start date;
  v_times text[];
  v_package numeric := 30;
  v_configured numeric;
  v_taken numeric;
  v_restocked numeric;
  v_remaining numeric;
  v_target_taken integer;
  v_needed integer;
  v_anchor date := date '2026-11-11';
  v_inserted integer;
  v_first_added date;
begin
  select id into v_user
  from auth.users
  where lower(email)=lower('riwiswell@gmail.com')
  limit 1;

  foreach v_name in array array['Bilaxten','Diosmina Hesperidina','Losartán']
  loop
    select id,start_date,times,total_quantity
    into v_med_id,v_start,v_times,v_configured
    from public.medications
    where user_id=v_user
      and lower(name)=lower(v_name)
      and active=true
    order by start_date desc,created_at desc
    limit 1;

    if v_med_id is null then
      raise exception 'No se encontró el medicamento activo %.',v_name;
    end if;

    select count(*) into v_taken
    from public.medication_doses
    where medication_id=v_med_id and status='taken';

    select coalesce(sum(quantity),0) into v_restocked
    from public.medication_stock_movements
    where medication_id=v_med_id;

    -- El total configurado representa las unidades que se cargaron al ciclo;
    -- las tomas ya registradas se descuentan y las reposiciones se suman.
    v_remaining := coalesce(v_configured,0) - v_taken + v_restocked;
    if v_remaining < 0 or v_remaining > v_package then
      raise exception 'El saldo calculado de % es %, incompatible con una caja de 30. Revisa el inventario antes de reconstruir.',v_name,v_remaining;
    end if;

    v_target_taken := greatest(0,round(v_package+v_restocked-v_remaining)::integer);
    if v_taken > v_target_taken then
      raise exception '% ya tiene % tomas registradas, pero el saldo de caja implica % consumidas. No se modifica ese medicamento para evitar duplicar consumo.',v_name,v_taken,v_target_taken;
    end if;

    v_needed := v_target_taken - v_taken;
    v_anchor := least(date '2026-11-11',v_start - 1);
    v_first_added := null;
    v_inserted := 0;

    if v_needed > 0 then
      with candidates as (
        select
          g.day::date as dose_date,
          t.scheduled_time
        from generate_series(
          v_anchor::timestamp,
          (v_anchor - 365)::timestamp,
          interval '-1 day'
        ) as g(day)
        cross join lateral unnest(coalesce(v_times,array[]::text[])) as t(scheduled_time)
        where not exists (
          select 1
          from public.medication_doses d
          where d.medication_id=v_med_id
            and d.dose_date=g.day::date
            and d.scheduled_time=t.scheduled_time
        )
        order by g.day desc,t.scheduled_time asc
        limit v_needed
      ),
      inserted as (
        insert into public.medication_doses
          (user_id,medication_id,dose_date,scheduled_time,scheduled_at,status,taken_at,entry_origin)
        select
          v_user,
          v_med_id,
          dose_date,
          scheduled_time,
          ((dose_date + scheduled_time::time) at time zone 'America/Bogota'),
          'taken',
          ((dose_date + scheduled_time::time) at time zone 'America/Bogota'),
          'stock_estimate'
        from candidates
        on conflict (medication_id,dose_date,scheduled_time) do nothing
        returning dose_date
      )
      select count(*)::integer,min(dose_date)
      into v_inserted,v_first_added
      from inserted;

      if v_inserted <> v_needed then
        raise exception 'Solo se pudieron crear % de % tomas para %. Revisa las horas y los registros existentes.',v_inserted,v_needed,v_name;
      end if;
    end if;

    -- Cargar el tamaño real de la caja y retroceder el inicio del ciclo para
    -- que el historial reconstruido sea visible y cuente para el saldo.
    update public.medications m
    set total_quantity=v_package,
        start_date=least(
          m.start_date,
          coalesce(v_first_added,m.start_date),
          coalesce(
            (select min(dose_date) from public.medication_doses
             where medication_id=v_med_id and status in ('taken','skipped')),
            m.start_date
          )
        )
    where m.id=v_med_id;

    raise notice '%: saldo antes del ajuste=%, tomas ya registradas=%, tomas añadidas=%, caja=30.',
      v_name,v_remaining,v_taken,v_inserted;
  end loop;
end $$;

-- 5) Revisión final: saldos de las tres cajas activas y origen de las tomas.
select
  m.name,
  m.start_date,
  m.times,
  m.total_quantity as unidades_de_la_caja,
  count(d.id) filter (where d.status='taken') as tomas_confirmadas_o_reconstruidas,
  count(d.id) filter (where d.entry_origin='stock_estimate') as estimadas_por_inventario,
  count(d.id) filter (where d.entry_origin='restored_snapshot') as restauradas_de_captura,
  m.total_quantity
    - count(d.id) filter (where d.status='taken')
    + coalesce((
        select sum(sm.quantity)
        from public.medication_stock_movements sm
        where sm.medication_id=m.id
      ),0) as saldo_calculado
from public.medications m
left join public.medication_doses d
  on d.medication_id=m.id
 and d.dose_date>=m.start_date
where m.user_id=(select id from auth.users where lower(email)=lower('riwiswell@gmail.com') limit 1)
  and m.active=true
  and lower(m.name) in (lower('Bilaxten'),lower('Diosmina Hesperidina'),lower('Losartán'))
group by m.id,m.name,m.start_date,m.times,m.total_quantity
order by m.name;

commit;
