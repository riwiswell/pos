-- Enforce one active work timer per user even when two tabs/devices race.
-- If a production account already has multiple active sessions, this migration
-- fails safely rather than silently discarding or rewriting work history.
create unique index if not exists work_sessions_one_active_per_user_uidx
  on public.work_sessions(user_id)
  where status = 'active';
