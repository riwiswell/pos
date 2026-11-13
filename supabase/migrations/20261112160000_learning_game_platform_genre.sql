-- Personal OS: optional platform and genre metadata for video games.
-- Safe and idempotent: adds nullable columns without changing existing rows.
alter table public.learning_items
  add column if not exists platform text,
  add column if not exists genre text;

alter table public.learning_items
  drop constraint if exists learning_items_platform_check,
  drop constraint if exists learning_items_genre_check;

alter table public.learning_items
  add constraint learning_items_platform_check
    check (platform is null or length(platform) <= 80),
  add constraint learning_items_genre_check
    check (genre is null or length(genre) <= 80);
