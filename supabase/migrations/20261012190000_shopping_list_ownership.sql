-- Keep each shopping item attached to a list owned by the same authenticated user.
-- Row ownership alone is insufficient: a caller who learns another list UUID
-- must not be able to attach their own item to that foreign list.

drop policy if exists shopping_items_insert on public.shopping_items;
create policy shopping_items_insert
  on public.shopping_items
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
        from public.shopping_lists l
       where l.id = list_id
         and l.user_id = (select auth.uid())
    )
  );

drop policy if exists shopping_items_update on public.shopping_items;
create policy shopping_items_update
  on public.shopping_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
        from public.shopping_lists l
       where l.id = list_id
         and l.user_id = (select auth.uid())
    )
  );
