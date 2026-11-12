-- POS / Personal OS — Corrección de ciclo de Losartán.
-- IMPORTANTE:
--   * Separa la caja nueva de 30 de las 8 tomas previas.
--   * Conserva las tomas previas en una ficha histórica inactiva.
--   * Retira SOLO las 19 estimaciones equivocadamente asociadas al ciclo viejo.
--   * Crea una ficha activa independiente para la caja nueva y estima su consumo.
--
-- Saldo físico usado abajo: 3 pastillas (el saldo que aparecía en la tabla anterior).
-- Si el conteo físico actual es distinto, cambia v_remaining_physical en el bloque.
-- No ejecuta eliminaciones sobre ninguna otra medicina ni sobre la ficha histórica
-- anterior de Losartán que ya tenía end_date en octubre.

begin;

alter table public.medication_doses
  add column if not exists entry_origin text not null default 'manual';

do $$
declare
  v_user uuid;
  v_old_id uuid;
  v_new_id uuid;
  v_old_estimates integer;
  v_remaining_physical integer := 3; -- AJUSTAR SOLO SI EL CONTEO FÍSICO NO ES 3
  v_package_size integer := 30;
  v_target_taken integer;
  v_anchor date := date '2026-11-11'; -- fecha local de referencia del registro
  v_start date;
  v_dose numeric;
  v_unit text;
  v_frequency text;
  v_times text[];
  v_remind_offset integer;
  v_stock_unit text;
  v_units_per_dose numeric;
  v_notes text;
  v_inserted integer;
begin
  select id into v_user
  from auth.users
  where lower(email)=lower('riwiswell@gmail.com')
  limit 1;

  if v_user is null then
    raise exception 'No se encontró la cuenta de POS.';
  end if;

  if v_remaining_physical < 0 or v_remaining_physical > v_package_size then
    raise exception 'El saldo físico debe estar entre 0 y 30.';
  end if;

  -- Evita repetir la operación si ya se creó el ciclo nuevo.
  select id into v_new_id
  from public.medications
  where user_id=v_user
    and active=true
    and lower(name)=lower('Losartán')
    and coalesce(notes,'') like '%CICLO_NUEVO_CAJA_30_20261111%'
  order by created_at desc
  limit 1;

  if v_new_id is not null then
    raise notice 'El ciclo nuevo de Losartán ya existe. No se hicieron cambios.';
    return;
  end if;

  -- Debe existir una sola ficha activa de Losartán que contiene las 19
  -- estimaciones de la operación anterior.
  select id into v_old_id
  from public.medications
  where user_id=v_user
    and active=true
    and lower(name)=lower('Losartán')
  order by created_at desc
  limit 1;

  if v_old_id is null then
    raise exception 'No se encontró la ficha activa de Losartán para separar.';
  end if;

  select count(*)::integer into v_old_estimates
  from public.medication_doses
  where medication_id=v_old_id
    and entry_origin='stock_estimate';

  if v_old_estimates <> 19 then
    raise exception 'Se esperaban exactamente 19 estimaciones equivocadas en la ficha anterior; encontré %. No se modificó nada.',v_old_estimates;
  end if;

  select dose,unit,frequency,times,remind_offset_min,stock_unit,units_per_dose,notes
  into v_dose,v_unit,v_frequency,v_times,v_remind_offset,v_stock_unit,v_units_per_dose,v_notes
  from public.medications
  where id=v_old_id and user_id=v_user;

  if coalesce(array_length(v_times,1),0) <> 1 or v_times[1] <> '10:00' then
    raise exception 'Los horarios de Losartán no coinciden con el horario esperado 10:00. No se modificó nada.';
  end if;

  v_target_taken := v_package_size - v_remaining_physical;
  v_start := v_anchor - (v_target_taken - 1);

  -- Retira solamente las 19 estimaciones mal asociadas a la caja anterior.
  delete from public.medication_doses
  where medication_id=v_old_id
    and entry_origin='stock_estimate';

  -- Conserva las tomas manuales anteriores en una ficha archivada separada.
  -- La cantidad configurada original de esa ficha era 11; se restituye ese valor
  -- para que sus 8 registros no formen parte del saldo de la caja nueva.
  update public.medications
  set name='Losartán (ciclo anterior)',
      active=false,
      end_date=v_anchor,
      total_quantity=11,
      notes=concat_ws(E'\n',nullif(notes,''),'Archivado al separar la caja nueva de 30 unidades el 2026-11-11. Se conservan sus tomas previas; no descuentan de la caja nueva.')
  where id=v_old_id and user_id=v_user;

  -- Crea una ficha independiente para la caja nueva: 30 unidades de entrada.
  insert into public.medications(
    user_id,name,dose,unit,frequency,times,start_date,end_date,active,
    notes,remind_offset_min,total_quantity,stock_unit,units_per_dose
  )
  values(
    v_user,
    'Losartán',
    v_dose,
    v_unit,
    coalesce(v_frequency,'daily'),
    coalesce(v_times,array['10:00']::text[]),
    v_start,
    null,
    true,
    concat_ws(E'\n',nullif(v_notes,''),'CICLO_NUEVO_CAJA_30_20261111. Caja nueva: 30 pastillas. Saldo físico declarado: ',v_remaining_physical,'. Tomas pasadas estimadas a partir del inventario; no incluye las tomas del ciclo anterior.'),
    coalesce(v_remind_offset,0),
    v_package_size,
    coalesce(v_stock_unit,'pastilla'),
    coalesce(v_units_per_dose,1)
  )
  returning id into v_new_id;

  -- Si quedan 3 físicamente, registra 27 estimaciones de la caja nueva,
  -- una por día a las 10:00, desde el 16/10 hasta el 11/11.
  insert into public.medication_doses(
    user_id,medication_id,dose_date,scheduled_time,scheduled_at,
    status,taken_at,entry_origin
  )
  select
    v_user,
    v_new_id,
    d::date,
    '10:00',
    ((d::date + time '10:00') at time zone 'America/Bogota'),
    'taken',
    ((d::date + time '10:00') at time zone 'America/Bogota'),
    'stock_estimate'
  from generate_series(v_start::timestamp,v_anchor::timestamp,interval '1 day') as g(d);

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_target_taken then
    raise exception 'Se insertaron % estimaciones, pero se esperaban %. Se revierte toda la operación.',v_inserted,v_target_taken;
  end if;

  raise notice 'Losartán separado correctamente: caja nueva=%, estimaciones nuevas=%, saldo físico=%.',
    v_package_size,v_inserted,v_remaining_physical;
end $$;

-- Resultado: el ciclo nuevo debe mostrar 30 - estimaciones = saldo físico.
select
  name,
  active,
  start_date,
  times,
  total_quantity as caja_inicial,
  count(d.id) filter (where d.status='taken') as tomas_del_ciclo_nuevo,
  total_quantity-count(d.id) filter (where d.status='taken') as saldo_calculado
from public.medications m
left join public.medication_doses d on d.medication_id=m.id
where m.user_id=(select id from auth.users where lower(email)=lower('riwiswell@gmail.com') limit 1)
  and lower(m.name) like lower('Losartán%')
group by m.id,name,active,start_date,times,total_quantity
order by active desc,start_date desc;

commit;
