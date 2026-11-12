-- Personal OS: optional bibliographic metadata for books.
-- Append-only migration. No user rows are inserted or rewritten.
alter table public.learning_items
  add column if not exists author text,
  add column if not exists publication_year integer;
