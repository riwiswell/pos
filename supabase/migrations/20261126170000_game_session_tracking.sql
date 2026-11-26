-- Game session tracking: Steam cumulative playtime baseline and mobile session timestamps.
-- Additive only: existing learning history and totals are preserved.
ALTER TABLE public.learning_items
  ADD COLUMN IF NOT EXISTS steam_playtime_minutes integer;

ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

ALTER TABLE public.learning_items
  ADD CONSTRAINT learning_items_steam_playtime_minutes_nonnegative
  CHECK (steam_playtime_minutes IS NULL OR steam_playtime_minutes >= 0)
  NOT VALID;

ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_valid_game_session_times
  CHECK (
    (started_at IS NULL AND ended_at IS NULL)
    OR (started_at IS NOT NULL AND ended_at IS NOT NULL AND ended_at > started_at)
  )
  NOT VALID;
