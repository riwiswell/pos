-- Shopping lists and items are used by Diario and are part of the source schema.
-- This migration deliberately precedes the Life Graph migration that installs
-- updated_at triggers and RLS policies for shopping_items.
create extension if not exists pgcrypto;

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null,
  note text,
  checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopping_items add column if not exists note text;

create index if not exists shopping_lists_user_position_idx
  on public.shopping_lists(user_id, position);
create index if not exists shopping_items_user_list_position_idx
  on public.shopping_items(user_id, list_id, position);

alter table public.shopping_lists enable row level security;
revoke all on table public.shopping_lists from anon;
grant select, insert, update, delete on table public.shopping_lists to authenticated;
drop policy if exists shopping_lists_select on public.shopping_lists;
drop policy if exists shopping_lists_insert on public.shopping_lists;
drop policy if exists shopping_lists_update on public.shopping_lists;
drop policy if exists shopping_lists_delete on public.shopping_lists;
create policy shopping_lists_select on public.shopping_lists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy shopping_lists_insert on public.shopping_lists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy shopping_lists_update on public.shopping_lists
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy shopping_lists_delete on public.shopping_lists
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.shopping_items enable row level security;
revoke all on table public.shopping_items from anon;
grant select, insert, update, delete on public.shopping_items to authenticated;
drop policy if exists shopping_items_select on public.shopping_items;
drop policy if exists shopping_items_insert on public.shopping_items;
drop policy if exists shopping_items_update on public.shopping_items;
drop policy if exists shopping_items_delete on public.shopping_items;
create policy shopping_items_select on public.shopping_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy shopping_items_insert on public.shopping_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy shopping_items_update on public.shopping_items
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy shopping_items_delete on public.shopping_items
  for delete to authenticated using ((select auth.uid()) = user_id);
