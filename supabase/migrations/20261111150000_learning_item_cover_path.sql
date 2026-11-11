-- Optional private Storage object path for the cover image of a learning item.
-- Images are kept in the existing private finance-photos bucket under the owner's UUID folder.
alter table public.learning_items
  add column if not exists cover_path text;
