-- Personal OS: prevent authenticated clients from minting their own XP.
-- Writes happen through source-table triggers; users can inspect their own ledger.
-- This is an append-only security hardening migration.

-- The event bus and XP materializer must be able to write under RLS, but direct
-- clients must not be able to forge life events, XP ledger entries or XP totals.
alter function public.emit_life_event()
  security definer;
alter function public.emit_life_event()
  set search_path = public, pg_temp;

alter function public.apply_gamification_for_life_event()
  security definer;
alter function public.apply_gamification_for_life_event()
  set search_path = public, pg_temp;

-- life_events: derived from real source-table activity, never client-authored.
drop policy if exists life_events_all_own on public.life_events;
drop policy if exists life_events_select on public.life_events;
drop policy if exists life_events_insert on public.life_events;
drop policy if exists life_events_update on public.life_events;
drop policy if exists life_events_delete on public.life_events;
create policy life_events_select_own
  on public.life_events for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on table public.life_events from authenticated;
grant select on table public.life_events to authenticated;
revoke all on table public.life_events from anon;

-- gamification_profiles: XP, level and streaks are materialized by database
-- triggers and cannot be changed through the browser Supabase client.
drop policy if exists gamification_profiles_all_own on public.gamification_profiles;
drop policy if exists gamification_profiles_select on public.gamification_profiles;
drop policy if exists gamification_profiles_insert on public.gamification_profiles;
drop policy if exists gamification_profiles_update on public.gamification_profiles;
drop policy if exists gamification_profiles_delete on public.gamification_profiles;
create policy gamification_profiles_select_own
  on public.gamification_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on table public.gamification_profiles from authenticated;
grant select on table public.gamification_profiles to authenticated;
revoke all on table public.gamification_profiles from anon;

-- XP events are the immutable audit ledger for each awarded action/reward.
drop policy if exists gamification_xp_events_all_own on public.gamification_xp_events;
create policy gamification_xp_events_select_own
  on public.gamification_xp_events for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on table public.gamification_xp_events from authenticated;
grant select on table public.gamification_xp_events to authenticated;
revoke all on table public.gamification_xp_events from anon;

-- Achievements are unlocked by the XP trigger, not by client writes.
drop policy if exists gamification_achievements_all_own on public.gamification_achievements;
drop policy if exists gamification_achievements_select on public.gamification_achievements;
drop policy if exists gamification_achievements_insert on public.gamification_achievements;
drop policy if exists gamification_achievements_update on public.gamification_achievements;
drop policy if exists gamification_achievements_delete on public.gamification_achievements;
create policy gamification_achievements_select_own
  on public.gamification_achievements for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on table public.gamification_achievements from authenticated;
grant select on table public.gamification_achievements to authenticated;
revoke all on table public.gamification_achievements from anon;
