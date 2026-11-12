-- Personal OS · reconstrucción de agua y diagnóstico del historial de medicamentos.
-- Ejecutar en el SQL Editor del proyecto que usa actualmente POS.
-- El registro de agua es idempotente: no duplica si ya existe uno equivalente.

do $$
declare
  v_user uuid;
begin
  select id into v_user
  from auth.users
  where lower(email) = lower('riwiswell@gmail.com')
  limit 1;

  if v_user is null then
    raise exception 'No se encontró el usuario riwiswell@gmail.com en auth.users.';
  end if;

  -- El usuario informó el 11/11 que la noche anterior (10/11)
  -- había tomado un vaso de 11 oz. 11 oz ≈ 325 ml.
  insert into public.hydration_entries
    (user_id, consumed_on, consumed_at, beverage_type, amount_ml, note)
  select
    v_user,
    date '2026-11-10',
    now(),
    'water',
    325,
    'Reconstruido el 11/11/2026: un vaso de 11 oz informado por el usuario; hora exacta no disponible.'
  where not exists (
    select 1
    from public.hydration_entries h
    where h.user_id = v_user
      and h.consumed_on = date '2026-11-10'
      and h.beverage_type = 'water'
      and h.amount_ml = 325
      and h.note like 'Reconstruido el 11/11/2026:%'
  )
  and not exists (
    select 1
    from public.health_metrics old
    where old.user_id = v_user
      and old.metric_date = date '2026-11-10'
      and coalesce(old.water_liters,0) >= 0.30
  );
end $$;

-- Diagnóstico: datos necesarios para reconstruir tomas sin inventar fechas,
-- horarios ni cantidades. Comparte el resultado antes de ejecutar un backfill.
with taken as (
  select medication_id, count(*)::numeric as taken_count
  from public.medication_doses
  where status = 'taken'
  group by medication_id
),
restocked as (
  select medication_id, coalesce(sum(quantity),0)::numeric as restocked
  from public.medication_stock_movements
  group by medication_id
)
select
  m.name,
  m.dose,
  m.unit,
  m.frequency,
  m.times,
  m.start_date,
  m.end_date,
  m.total_quantity as cantidad_inicial_configurada,
  coalesce(t.taken_count,0) as tomas_ya_registradas,
  coalesce(r.restocked,0) as unidades_repuestas,
  coalesce(m.total_quantity,0) - coalesce(t.taken_count,0) + coalesce(r.restocked,0) as saldo_calculado
from public.medications m
left join taken t on t.medication_id = m.id
left join restocked r on r.medication_id = m.id
where m.user_id = (
  select id from auth.users
  where lower(email) = lower('riwiswell@gmail.com')
  limit 1
)
order by m.active desc, m.name;
