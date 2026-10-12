-- Personal OS: award the configured XP when a challenge is actually completed.
-- Append-only; rewards are guarded by a stable XP-ledger key so retries cannot double-award.

create or replace function public.award_gamification_challenge_reward()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reward integer;
  rows_inserted integer;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'completed' then
    return new;
  end if;

  reward := greatest(0, coalesce(new.reward_xp, 0));
  if reward = 0 then
    return new;
  end if;

  insert into public.gamification_xp_events(
    user_id, life_event_id, event_key, xp, reason
  )
  values(
    new.user_id, null, 'challenge:' || new.id::text, reward,
    'Desafío completado: ' || new.title
  )
  on conflict (user_id, event_key) do nothing;

  get diagnostics rows_inserted = row_count;
  if rows_inserted = 0 then
    return new;
  end if;

  insert into public.gamification_profiles(user_id, xp, level)
  values(new.user_id, reward, 1)
  on conflict (user_id) do update
    set xp = public.gamification_profiles.xp + excluded.xp,
        updated_at = now();

  update public.gamification_profiles
     set level = greatest(1, floor(xp / 100.0)::integer + 1),
         updated_at = now()
   where user_id = new.user_id;

  return new;
end
$$;

drop trigger if exists gamification_challenge_reward on public.gamification_challenges;
create trigger gamification_challenge_reward
after insert or update on public.gamification_challenges
for each row execute function public.award_gamification_challenge_reward();

-- Backfill rewards for challenges that were already completed before this feature.
-- The unique event_key only adds XP if that challenge's reward wasn't recorded yet.
with awarded as (
  insert into public.gamification_xp_events(
    user_id, life_event_id, event_key, xp, reason
  )
  select c.user_id, null, 'challenge:' || c.id::text, greatest(0, coalesce(c.reward_xp, 0)),
         'Desafío completado: ' || c.title
    from public.gamification_challenges c
   where c.status = 'completed'
     and greatest(0, coalesce(c.reward_xp, 0)) > 0
  on conflict (user_id, event_key) do nothing
  returning user_id, xp
), totals as (
  select user_id, sum(xp)::integer as xp
    from awarded
   group by user_id
), updated_profiles as (
  insert into public.gamification_profiles(user_id, xp, level)
  select user_id, xp, 1 from totals
  on conflict (user_id) do update
    set xp = public.gamification_profiles.xp + excluded.xp,
        updated_at = now()
  returning user_id
)
update public.gamification_profiles gp
   set level = greatest(1, floor(gp.xp / 100.0)::integer + 1),
       updated_at = now()
  from updated_profiles up
 where gp.user_id = up.user_id;
