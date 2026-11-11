-- Separate a book's full length from an optional intermediate page goal.
alter table public.learning_items
  add column if not exists target_pages integer;

alter table public.learning_items
  drop constraint if exists learning_items_target_pages_check;
alter table public.learning_items
  add constraint learning_items_target_pages_check
  check (target_pages is null or target_pages > 0);

-- Correct Ricardo's imported copy: 1,022 pages is the actual book length;
-- 712 pages remains his intermediate target, not the book's end.
update public.learning_items li
set total_pages = 1022,
    target_pages = 712,
    updated_at = now()
where li.kind = 'book'
  and lower(trim(li.title)) = lower('La historia del arte')
  and li.user_id = (
    select u.id from auth.users u
    where lower(u.email) = lower('riwiswell@gmail.com')
    limit 1
  );
