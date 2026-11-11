-- Inventory-aware medication records and a single source for fluid intake.
-- Existing medication rows remain valid; new stock fields are independent from
-- the strength/dose unit (for example, 50 mg strength vs 30 tablets in the box).

alter table public.medications
  add column if not exists stock_unit text not null default 'unidad',
  add column if not exists units_per_dose numeric(10,3) not null default 1;

alter table public.medications
  drop constraint if exists medications_units_per_dose_check;
alter table public.medications
  add constraint medications_units_per_dose_check
  check (units_per_dose > 0);

create table if not exists public.medication_stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  movement_type text not null default 'restock' check (movement_type in ('restock','adjustment')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists medication_stock_movements_user_med_idx
  on public.medication_stock_movements(user_id, medication_id, created_at desc);

alter table public.medication_stock_movements enable row level security;
revoke all on table public.medication_stock_movements from anon;
grant select, insert on table public.medication_stock_movements to authenticated;
drop policy if exists medication_stock_movements_select_own on public.medication_stock_movements;
drop policy if exists medication_stock_movements_insert_own on public.medication_stock_movements;
create policy medication_stock_movements_select_own on public.medication_stock_movements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy medication_stock_movements_insert_own on public.medication_stock_movements
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.medications medication
      where medication.id = medication_id and medication.user_id = (select auth.uid())
    )
  );

create table if not exists public.hydration_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_on date not null default current_date,
  consumed_at timestamptz not null default now(),
  beverage_type text not null check (beverage_type in ('water','coffee','tea','milk','other')),
  amount_ml integer not null check (amount_ml between 1 and 5000),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists hydration_entries_user_day_idx
  on public.hydration_entries(user_id, consumed_on, consumed_at);

alter table public.hydration_entries enable row level security;
revoke all on table public.hydration_entries from anon;
grant select, insert, update, delete on table public.hydration_entries to authenticated;
drop policy if exists hydration_entries_select_own on public.hydration_entries;
drop policy if exists hydration_entries_insert_own on public.hydration_entries;
drop policy if exists hydration_entries_update_own on public.hydration_entries;
drop policy if exists hydration_entries_delete_own on public.hydration_entries;
create policy hydration_entries_select_own on public.hydration_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy hydration_entries_insert_own on public.hydration_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy hydration_entries_update_own on public.hydration_entries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy hydration_entries_delete_own on public.hydration_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Stable import keys let a trusted external sales integration be retried safely.
alter table public.finance_transactions
  add column if not exists external_source text,
  add column if not exists external_id text;

create unique index if not exists finance_transactions_external_unique
  on public.finance_transactions(user_id, external_source, external_id)
  where external_source is not null and external_id is not null;
