begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.finance_transactions
  add column if not exists external_source text,
  add column if not exists external_id text;

create unique index if not exists finance_transactions_external_unique
  on public.finance_transactions(user_id,external_source,external_id)
  where external_source is not null and external_id is not null;

create table if not exists private.wiswellart_tienda_sync_config (
  singleton boolean primary key default true check (singleton),
  active boolean not null default true,
  user_id uuid not null references auth.users(id) on delete cascade,
  income_category_id uuid not null references public.finance_categories(id),
  expense_category_id uuid not null references public.finance_categories(id),
  shared_secret_hash bytea not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.wiswellart_tienda_payment_accounts (
  payment_method_key text primary key,
  account_id uuid not null references public.finance_accounts(id) on delete restrict
);

revoke all on all tables in schema private from public, anon, authenticated;

do $$
declare
  v_user uuid := '524c4bcb-d521-4af2-97c7-032faa1a01f7';
  v_income uuid := 'a2b1f6f8-e594-4243-9e50-22dedcc239a9';
  v_expense uuid := 'eef2e9af-4895-44a6-80a4-2c5c377a1ef4';
begin
  if not exists (
    select 1 from public.finance_categories
    where id=v_income and user_id=v_user and kind='income' and active
  ) then raise exception 'No se encontró la categoría de ingreso WíswellArt del usuario riwiswell@gmail.com.'; end if;

  if not exists (
    select 1 from public.finance_categories
    where id=v_expense and user_id=v_user and kind in ('expense','both') and active
  ) then raise exception 'No se encontró la categoría de gasto Tienda del usuario riwiswell@gmail.com.'; end if;

  if (select count(*) from public.finance_accounts
      where user_id=v_user and id in (
        'd06c2bba-39f0-4c5a-92f9-ad3b4a29c7e7',
        '098114a2-53d2-45c7-8a48-c2c17f61d793',
        'c7b649ec-6450-4783-8abf-c29ef1fe52bc'
      )) <> 3 then
    raise exception 'No se encontraron las tres cuentas de POS (Efectivo, Nequi y Daviplata).';
  end if;
end;
$$;

insert into private.wiswellart_tienda_sync_config(
  singleton,active,user_id,income_category_id,expense_category_id,shared_secret_hash,updated_at
)
values (
  true,true,
  '524c4bcb-d521-4af2-97c7-032faa1a01f7',
  'a2b1f6f8-e594-4243-9e50-22dedcc239a9',
  'eef2e9af-4895-44a6-80a4-2c5c377a1ef4',
  decode('e34a150dccef317371e8994a73d1e850712c9bb9148cf36bf4a0fb43fd1d277d','hex'),
  now()
)
on conflict (singleton) do update
set active=excluded.active,
    user_id=excluded.user_id,
    income_category_id=excluded.income_category_id,
    expense_category_id=excluded.expense_category_id,
    shared_secret_hash=excluded.shared_secret_hash,
    updated_at=now();

insert into private.wiswellart_tienda_payment_accounts(payment_method_key,account_id)
values
  ('efectivo','d06c2bba-39f0-4c5a-92f9-ad3b4a29c7e7'),
  ('nequi','098114a2-53d2-45c7-8a48-c2c17f61d793'),
  ('daviplata','c7b649ec-6450-4783-8abf-c29ef1fe52bc')
on conflict (payment_method_key) do update
set account_id=excluded.account_id;

create or replace function public.receive_wiswellart_tienda_event(
  p_secret text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config private.wiswellart_tienda_sync_config%rowtype;
  v_entity_type text;
  v_operation text;
  v_raw_id text;
  v_external_id text;
  v_type text;
  v_amount numeric;
  v_method text;
  v_account_id uuid;
  v_category_id uuid;
  v_occurred_on date;
  v_note text;
  v_deleted integer;
begin
  select * into v_config
  from private.wiswellart_tienda_sync_config
  where singleton=true and active=true;

  if not found then
    raise exception 'La integración WíswellArt Tienda → POS no está activa.'
      using errcode='55000';
  end if;

  if p_secret is null or extensions.digest(convert_to(p_secret,'UTF8'),'sha256') is distinct from v_config.shared_secret_hash then
    raise exception 'Credenciales inválidas para la integración WíswellArt Tienda → POS.'
      using errcode='28000';
  end if;

  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'El evento externo no tiene un payload JSON válido.';
  end if;

  v_entity_type := p_payload->>'entity_type';
  v_operation := p_payload->>'operation';
  v_raw_id := nullif(trim(p_payload->>'external_id'),'');
  if v_raw_id is null then raise exception 'Falta el identificador externo del movimiento.'; end if;
  if v_entity_type not in ('sale_payment','expense') then raise exception 'Tipo de evento externo no permitido.'; end if;

  v_external_id := v_entity_type || ':' || v_raw_id;

  if v_operation='delete' then
    delete from public.finance_transactions
    where user_id=v_config.user_id
      and external_source='wiswellart_tienda'
      and external_id=v_external_id;
    get diagnostics v_deleted = row_count;
    return jsonb_build_object('ok',true,'operation','delete','deleted',v_deleted,'external_id',v_external_id);
  end if;

  if v_operation<>'upsert' then raise exception 'Operación externa no permitida.'; end if;

  if v_entity_type='sale_payment' then
    v_type := 'income';
    v_category_id := v_config.income_category_id;
  else
    v_type := 'expense';
    v_category_id := v_config.expense_category_id;
  end if;

  v_amount := nullif(p_payload->>'amount','')::numeric;
  if v_amount is null or v_amount<=0 then raise exception 'El importe externo debe ser mayor que cero.'; end if;

  v_occurred_on := nullif(p_payload->>'occurred_on','')::date;
  if v_occurred_on is null then raise exception 'Falta la fecha del movimiento externo.'; end if;

  v_method := lower(trim(coalesce(p_payload->>'payment_method','')));
  select account_id into v_account_id
  from private.wiswellart_tienda_payment_accounts
  where payment_method_key=v_method;

  v_note := nullif(trim(p_payload->>'note'),'');
  if v_account_id is null and v_method<>'' then
    v_note := concat_ws(' · ',v_note,'Medio de pago sin cuenta asociada: ' || (p_payload->>'payment_method'));
  elsif v_account_id is null then
    v_note := concat_ws(' · ',v_note,'Medio de pago sin especificar');
  end if;

  insert into public.finance_transactions(
    user_id,type,amount,cost_amount,account_id,category_id,
    occurred_on,occurred_time,note,tags,counts_for_tithe,
    is_tithe_payment,external_source,external_id,updated_at
  )
  values (
    v_config.user_id,v_type,v_amount,0,v_account_id,v_category_id,
    v_occurred_on,null,v_note,array['WíswellArt Tienda'],
    (v_type='income'),false,'wiswellart_tienda',v_external_id,now()
  )
  on conflict (user_id,external_source,external_id)
  where external_source is not null and external_id is not null
  do update set
    type=excluded.type,
    amount=excluded.amount,
    account_id=excluded.account_id,
    category_id=excluded.category_id,
    occurred_on=excluded.occurred_on,
    note=excluded.note,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,'operation','upsert','external_id',v_external_id,
    'type',v_type,'amount',v_amount,'account_id',v_account_id,'category_id',v_category_id
  );
end;
$$;

revoke all on function public.receive_wiswellart_tienda_event(text,jsonb) from public, authenticated;
grant execute on function public.receive_wiswellart_tienda_event(text,jsonb) to anon;

commit;
