-- Separate game progress target from current progress and correct the real
-- reading length of the finished Viktor Frankl title.
alter table public.learning_items
  add column if not exists target_progress integer;

alter table public.learning_items
  drop constraint if exists learning_items_target_progress_check;
alter table public.learning_items
  add constraint learning_items_target_progress_check
  check (target_progress is null or target_progress between 1 and 100);

-- A 100% goal means the whole game; users can choose an intermediate target.
-- The standard target_date column already exists and is shared by both goals.

-- Ricardo's copy was imported as 129 pages, but the actual reading edition
-- is 111 pages. Preserve its completed state and normalize the page counter.
update public.learning_items li
set total_pages = 111,
    current_page = 111,
    progress = 100,
    completed_on = coalesce(li.completed_on, current_date),
    updated_at = now()
where li.kind = 'book'
  and lower(trim(li.title)) like 'el hombre en busca de sentido%'
  and li.user_id = (
    select u.id from auth.users u
    where lower(u.email) = lower('riwiswell@gmail.com')
    limit 1
  );
