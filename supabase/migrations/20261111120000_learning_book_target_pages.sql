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


-- Correct the imported reading length for the completed Viktor Frankl book.
-- Its 129-page physical edition includes pages outside the 111-page reading content.
update public.learning_items li
set total_pages = 111,
    current_page = least(coalesce(li.current_page,111),111),
    progress = case
      when coalesce(li.current_page,111) >= 111 then 100
      else round((coalesce(li.current_page,0)::numeric / 111) * 100, 2)
    end,
    completed_on = case
      when coalesce(li.current_page,111) >= 111 then coalesce(li.completed_on,current_date)
      else li.completed_on
    end,
    updated_at = now()
where li.kind = 'book'
  and lower(trim(li.title)) like '%el hombre en busca de sentido%'
  and li.user_id = (
    select u.id from auth.users u
    where lower(u.email) = lower('riwiswell@gmail.com')
    limit 1
  );
