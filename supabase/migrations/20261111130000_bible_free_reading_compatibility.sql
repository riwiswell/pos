-- Compatibility fields retained for older Bible free-reading UI payloads.
-- The canonical fields are passage and note; these optional aliases make the
-- migration safe when an earlier manual table used scripture_reference/notes.
alter table public.bible_free_readings
  add column if not exists passage text,
  add column if not exists note text,
  add column if not exists scripture_reference text,
  add column if not exists notes text;
