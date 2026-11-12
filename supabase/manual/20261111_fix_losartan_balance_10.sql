-- POS / Personal OS — Corregir saldo real de la caja nueva de Losartán.
--
-- Corrección solicitada por el usuario:
--   Anoche quedaban 11 pastillas.
--   Hoy tomó 1 pastilla.
--   Saldo físico actual: 10 pastillas.
--
-- Caja nueva: 30 unidades.
-- Consumo total que debe reflejar este ciclo: 20 (19 previas estimadas + 1 de hoy).
-- La hora real de la toma de hoy no se indicó; se registra como tomada sin inventar
-- taken_at ni water_glasses. Se conserva el horario programado de las 10:00.
--
-- Solo modifica la ficha activa identificada por el marcador CICLO_NUEVO_CAJA_30_20261111.
-- NO modifica las dos fichas históricas inactivas de Losartán.
-- Se puede ejecutar más de una vez.

begin;

alter table public.medication_doses
  add column if not exists entry_origin text not null default 'manual';

do $$
declare
  v_user uuid;
  v_med_id uuid;
  v_times text[];
  v_current_estimates integer;
  v_inserted integer;
  v_taken integer;
  v_balance numeric;
begin
  select id into v_user
  from auth.users
  where lower(email)=lower('riwiswell@gmail.com')
  limit 1;

  if v_user is null then
    raise exception 'No se encontró la cuenta de POS.';
  end if;

  select id,times
  into v_med_id,v_times
  from public.medications
  where user_id=v_user
    and active=true
    and lower(name)=lower('Losartán')
    and coalesce(notes,'') like '%CICLO_NUEVO_CAJA_30_20261111%'
  order by created_at desc
  limit 1
  for update;

  if v_med_id is null then
    raise exception 'No se encontró la caja nueva activa de Losartán. No se modificó nada.';
  end if;

  if v_times is distinct from array['10:00']::text[] then
    raise exception 'El horario de la caja nueva ya no es 10:00. No se modificó nada.';
  end if;

  select count(*)::integer
  into v_current_estimates
  from public.medication_doses
  where medication_id=v_med_id
    and entry_origin='stock_estimate';

  if v_current_estimates not in (27,19) then
    raise exception 'Esperaba encontrar 27 estimaciones erróneas (o 19 tras una corrección previa), pero encontré %. No se modificó nada.',v_current_estimates;
  end if;

  -- Quitar exclusivamente las estimaciones erróneas del ciclo NUEVO de Losartán.
  delete from public.medication_doses
  where medication_id=v_med_id
    and entry_origin='stock_estimate';

  -- Se infieren 19 tomas previas a hoy: 23/oct a 10/nov, una diaria.
  insert into public.medication_doses(
    user_id,medication_id,dose_date,scheduled_time,scheduled_at,
    status,taken_at,entry_origin
  )
  select
    v_user,
    v_med_id,
    d::date,
    '10:00',
    ((d::date + time '10:00') at time zone 'America/Bogota'),
    'taken',
    ((d::date + time '10:00') at time zone 'America/Bogota'),
    'stock_estimate'
  from generate_series(
    timestamp '2026-10-23 00:00:00',
    timestamp '2026-11-10 00:00:00',
    interval '1 day'
  ) as g(d)
  on conflict (medication_id,dose_date,scheduled_time) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted <> 19 then
    raise exception 'Se insertaron % estimaciones en lugar de 19. Se revierte toda la operación.',v_inserted;
  end if;

  -- El usuario confirmó que tomó una pastilla hoy (11/nov).
  -- No se inventa hora real ni cantidad de agua; se mantiene taken_at NULL.
  insert into public.medication_doses(
    user_id,medication_id,dose_date,scheduled_time,scheduled_at,
    status,taken_at,water_glasses,entry_origin
  )
  values(
    v_user,
    v_med_id,
    date '2026-11-11',
    '10:00',
    (timestamp '2026-11-11 10:00:00' at time zone 'America/Bogota'),
    'taken',
    null,
    null,
    'manual'
  )
  on conflict (medication_id,dose_date,scheduled_time)
  do update set
    status='taken',
    taken_at=coalesce(public.medication_doses.taken_at, excluded.taken_at),
    updated_at=now();

  -- El total configurado sigue siendo la caja completa de 30.
  -- El saldo se calcula con 19 estimaciones + 1 toma confirmada hoy = 10.
  update public.medications
  set total_quantity=30,
      start_date=date '2026-10-23',
      notes=concat_ws(E'\n',
        nullif(notes,''),
        'SALDO_CORREGIDO_20261111: el usuario reportó 11 unidades al cierre del 10/11 y confirmó una toma el 11/11; saldo físico actual 10.'
      )
  where id=v_med_id
    and user_id=v_user;

  select count(*) filter (where status='taken')::integer
  into v_taken
  from public.medication_doses
  where medication_id=v_med_id
    and dose_date>=date '2026-10-23';

  v_balance := 30-v_taken;

  if v_taken <> 20 or v_balance <> 10 then
    raise exception 'La verificación dio % tomas y saldo %. Se revierte la operación porque no coincide con el saldo reportado.',v_taken,v_balance;
  end if;
end $$;

-- Debe devolver caja=30, 19 estimadas, 1 toma de hoy, saldo=10.
select
  m.name,
  m.active,
  m.start_date,
  m.times,
  m.total_quantity as caja_inicial,
  count(d.id) filter (where d.status='taken') as tomas_del_ciclo,
  count(d.id) filter (where d.entry_origin='stock_estimate') as estimadas_antes_de_hoy,
  count(d.id) filter (where d.dose_date=date '2026-11-11' and d.status='taken') as toma_confirmada_hoy,
  m.total_quantity-count(d.id) filter (where d.status='taken') as saldo_calculado
from public.medications m
left join public.medication_doses d
  on d.medication_id=m.id
 and d.dose_date>=date '2026-10-23'
where m.user_id=(select id from auth.users where lower(email)=lower('riwiswell@gmail.com') limit 1)
  and m.active=true
  and lower(m.name)=lower('Losartán')
  and coalesce(m.notes,'') like '%CICLO_NUEVO_CAJA_30_20261111%'
group by m.id,m.name,m.active,m.start_date,m.times,m.total_quantity;

commit;
