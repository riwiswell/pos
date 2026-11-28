-- Steam account connection for each authenticated POS user.
-- Additive only: no existing learning items or session history are modified.
CREATE TABLE IF NOT EXISTS public.steam_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
  personaname text NOT NULL,
  avatar_url text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.steam_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own Steam connection" ON public.steam_connections;
CREATE POLICY "Users can view their own Steam connection"
  ON public.steam_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own Steam connection" ON public.steam_connections;
CREATE POLICY "Users can insert their own Steam connection"
  ON public.steam_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own Steam connection" ON public.steam_connections;
CREATE POLICY "Users can update their own Steam connection"
  ON public.steam_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE ON public.steam_connections TO authenticated;

ALTER TABLE public.learning_items
  ADD COLUMN IF NOT EXISTS steam_appid bigint;
CREATE UNIQUE INDEX IF NOT EXISTS learning_items_user_steam_appid_uidx
  ON public.learning_items(user_id, steam_appid)
  WHERE steam_appid IS NOT NULL;

ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS steam_playtime_before_minutes integer,
  ADD COLUMN IF NOT EXISTS steam_playtime_after_minutes integer;
