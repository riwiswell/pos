-- POS · Niveles progresivos de gamificación
-- Ejecutar UNA SOLA VEZ en el SQL Editor del proyecto Supabase de POS:
-- eutrhjvdyrakrxmjemut
-- No ejecutar en ningún otro proyecto.
--
-- Reglas:
-- Nivel 1 → 2: 1.200 XP
-- Nivel 2 → 3: 1.500 XP adicionales
-- Nivel 3 → 4: 1.800 XP adicionales
-- Nivel 4 → 5: 2.100 XP adicionales
-- Nivel 5 → 6: 2.400 XP adicionales
-- Cada tramo posterior aumenta 300 XP.
--
-- El XP es acumulado de por vida. Se conserva el mayor total entre el perfil
-- actual y la suma del ledger existente; NO se vuelven a insertar eventos ni
-- se otorgan puntos por registros que no tengan un evento de XP.

begin;

create or replace function public.gamification_level_for_xp(p_xp bigint)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $function$
  with recursive progression(level_number, xp_at_level_start, xp_required) as (
    select 1::integer, 0::bigint, 1200::bigint
    union all
    select
      level_number + 1,
      xp_at_level_start + xp_required,
      xp_required + 300
    from progression
    where xp_at_level_start + xp_required <= greatest(0, coalesce(p_xp, 0))
  )
  select coalesce(max(level_number), 1)::integer
  from progression;
$function$;

-- Keep the existing trigger function name to replace the 200-XP calculation
-- installed by the previous migration without leaving competing triggers.
create or replace function public.sync_gamification_level_200()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.level := public.gamification_level_for_xp(greatest(0, coalesce(new.xp, 0))::bigint);
  return new;
end;
$function$;

drop trigger if exists gamification_profiles_level_200 on public.gamification_profiles;
create trigger gamification_profiles_level_200
before insert or update on public.gamification_profiles
for each row execute function public.sync_gamification_level_200();

-- Reconcile profile XP with the append-only ledger without adding totals twice.
-- If the profile already contains a higher verified total, preserve it.
insert into public.gamification_profiles(user_id, xp, level)
select
  user_id,
  least(sum(greatest(xp, 0)::bigint), 2147483647)::integer,
  1
from public.gamification_xp_events
group by user_id
on conflict (user_id) do update
  set xp = greatest(
        coalesce(public.gamification_profiles.xp, 0),
        excluded.xp
      ),
      updated_at = now();

-- Recalculate the stored level for every profile, keeping its XP untouched.
update public.gamification_profiles
   set level = public.gamification_level_for_xp(greatest(0, coalesce(xp, 0))::bigint),
       updated_at = now()
 where level is distinct from
       public.gamification_level_for_xp(greatest(0, coalesce(xp, 0))::bigint);

commit;

-- Verification:
select
  xp,
  level,
  public.gamification_level_for_xp(greatest(0, coalesce(xp, 0))::bigint) as expected_level
from public.gamification_profiles
order by xp desc;
