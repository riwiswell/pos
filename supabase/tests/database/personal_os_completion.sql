begin;

select plan(18);

select has_table('public','relationships','relationships exists');
select has_column('public','relationships','contact_frequency_days','relationship frequency exists');
select has_column('public','relationships','next_contact_on','relationship follow-up exists');
select has_table('public','relationship_interactions','relationship interactions exists');
select has_table('public','spiritual_entries','spiritual entries exists');
select has_column('public','spiritual_entries','prophecy','prophecy field exists');
select has_column('public','spiritual_entries','scripture_reference','scripture reference exists');
select has_table('public','spiritual_goals','spiritual goals exists');
select has_table('public','gamification_profiles','gamification profile exists');
select has_column('public','gamification_profiles','current_streak','current streak exists');
select has_column('public','gamification_profiles','best_streak','best streak exists');
select has_table('public','gamification_achievements','gamification achievements exists');
select has_table('public','gamification_challenges','gamification challenges exists');
select has_table('public','gamification_xp_events','xp ledger exists');
select has_index('public','gamification_xp_events','gamification_xp_events_user_key_uidx','xp idempotency index exists');
select has_function('public','apply_gamification_for_life_event','gamification trigger function exists');
select has_function('public','sync_relationship_interaction','relationship sync function exists');

select results_eq(
  $$select count(*)::integer
      from pg_trigger
     where tgrelid = 'public.life_events'::regclass
       and tgname = 'gamification_from_life_event'
       and not tgisinternal$$,
  $$values (1)$$,
  'gamification trigger is installed exactly once'
);

select * from finish();
rollback;
