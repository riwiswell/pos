begin;

select plan(97);

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
select has_function('public','award_gamification_challenge_reward','challenge reward trigger function exists');
select ok((
  select exists (
    select 1 from pg_trigger
     where tgrelid = 'public.gamification_challenges'::regclass
       and tgname = 'gamification_challenge_reward'
       and not tgisinternal
  )
), 'challenge completion reward trigger is installed');
select has_function('public','sync_relationship_interaction','relationship sync function exists');
select is(
  public.gamification_xp_for_event('habit_logs', '{"habit_kind":"activity"}'::jsonb),
  0,
  'activities do not award habit XP'
);
select is(
  public.gamification_xp_for_event('habit_logs', '{"habit_kind":"habit","completed":true}'::jsonb),
  5,
  'completed habit logs retain their expected XP'
);

select is(
  public.gamification_xp_for_event('habit_logs', '{"_operation":"UPDATE","habit_kind":"habit"}'::jsonb),
  0,
  'editing an existing habit log does not award XP again'
);

select is(
  public.gamification_xp_for_event('habit_logs', '{"_operation":"INSERT","habit_kind":"habit","completed":false,"value":0}'::jsonb),
  0,
  'creating an empty habit log does not award XP'
);
select is(
  public.gamification_xp_for_event('habit_logs', '{"_operation":"UPDATE","habit_kind":"habit","completed":true,"value":1}'::jsonb),
  5,
  'completing a habit log awards XP on the meaningful update'
);
select is(
  public.gamification_xp_for_event('routine_logs', '{"_operation":"INSERT","completed":false}'::jsonb),
  0,
  'an incomplete routine log does not award XP'
);
select is(
  public.gamification_xp_for_event('routine_logs', '{"_operation":"UPDATE","completed":true}'::jsonb),
  5,
  'completing a routine log awards XP once'
);
select is(
  public.gamification_xp_for_event('work_items', '{"_operation":"UPDATE","status":"done"}'::jsonb),
  0,
  'editing a work item does not mint additional XP'
);
select is(
  public.gamification_xp_for_event('work_sessions', '{"status":"active"}'::jsonb),
  0,
  'starting a work session does not award XP'
);
select is(
  public.gamification_xp_for_event('work_sessions', '{"status":"completed"}'::jsonb),
  10,
  'completing a work session awards XP once'
);

select is(
  public.gamification_xp_for_event('work_sessions', '{"_operation":"UPDATE","status":"completed"}'::jsonb),
  10,
  'transitioning an active work session to completed awards XP'
);

select is(
  public.gamification_xp_for_event('work_sessions', '{"_operation":"UPDATE","status":"active"}'::jsonb),
  0,
  'editing an active work session does not award XP'
);

select results_eq(
  $$select count(*)::integer
      from pg_trigger
     where tgrelid = 'public.life_events'::regclass
       and tgname = 'gamification_from_life_event'
       and not tgisinternal$$,
  $$values (1)$$,
  'gamification trigger is installed exactly once'
);


-- Isolation and notification wiring must be present in a fresh schema.
select ok((select relrowsecurity from pg_class where oid = 'public.habits'::regclass), 'habits has row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.habit_logs'::regclass), 'habit logs have row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.finance_transactions'::regclass), 'finance transactions have row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.shopping_lists'::regclass), 'shopping lists have row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.shopping_items'::regclass), 'shopping items have row-level security');

select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='shopping_items' and policyname='shopping_items_insert' and with_check like '%shopping_lists%'),
  1,
  'shopping item inserts require a list owned by the same user'
);

select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='shopping_items' and policyname='shopping_items_update' and with_check like '%shopping_lists%'),
  1,
  'shopping item updates cannot attach items to another user list'
);
select ok((select relrowsecurity from pg_class where oid = 'public.medical_appointments'::regclass), 'medical appointments have row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.notification_jobs'::regclass), 'notification jobs have row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass), 'push subscriptions have row-level security');
select ok((
  select exists (
    select 1 from pg_trigger
     where tgrelid = 'public.medical_appointments'::regclass
       and tgname = 'medical_appointment_notification_job'
       and not tgisinternal
  )
), 'medical appointment notification trigger is installed');

select ok((
  select exists (
    select 1 from pg_trigger
     where tgrelid = 'public.alarms'::regclass
       and tgname = 'alarms_sync_notification_job'
       and not tgisinternal
  )
), 'alarm background notification trigger is installed');

select is(
  (select count(*)::integer from pg_trigger
    where tgrelid = 'public.alarms'::regclass
      and tgname in ('alarm_notification_job','alarms_sync_notification_job')
      and not tgisinternal),
  1,
  'only the current alarm notification trigger remains installed'
);

-- Private media buckets must exist and be owned by per-user storage policies.
select ok((select exists(select 1 from storage.buckets where id = 'finance-photos' and public = false)), 'finance photo bucket exists and is private');
select ok((select exists(select 1 from storage.buckets where id = 'profile-media' and public = false)), 'profile media bucket exists and is private');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'pos_finance_photos_%'), 4, 'finance photo bucket has four per-user policies');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'pos_profile_media_%'), 4, 'profile media bucket has four per-user policies');
select ok((select exists(select 1 from pg_indexes where schemaname='public' and indexname='work_sessions_one_active_per_user_uidx')), 'only one active work session per user is enforced');


-- Shared spaces: separate tables, member-scoped access, invitations and team rewards.
select has_column('public','habits','icon','personal habits support custom icons');
select has_table('public','personal_shared_spaces','shared spaces table exists');
select has_table('public','personal_shared_space_members','shared space members table exists');
select has_table('public','personal_shared_space_invites','shared invitations table exists');
select has_table('public','personal_shared_habits','shared habits and activities table exists');
select has_table('public','personal_shared_habit_logs','per-member shared habit logs table exists');
select has_table('public','personal_shared_goals','shared goals and challenges table exists');
select has_table('public','personal_shared_goal_contributions','per-member goal contributions table exists');
select has_table('public','personal_shared_points_ledger','team points ledger exists');
select ok((
  select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public'
     and c.relname=any(array[
       'personal_shared_spaces','personal_shared_space_members','personal_shared_space_invites',
       'personal_shared_habits','personal_shared_habit_logs','personal_shared_goals',
       'personal_shared_goal_contributions','personal_shared_points_ledger'
     ])
), 'all shared-space tables have row-level security enabled');
select is((
  select count(*)::integer
    from pg_policies
   where schemaname='public'
     and tablename=any(array[
       'personal_shared_spaces','personal_shared_space_members','personal_shared_space_invites',
       'personal_shared_habits','personal_shared_habit_logs','personal_shared_goals',
       'personal_shared_goal_contributions','personal_shared_points_ledger'
     ])
     and policyname like 'personal_shared_%'
), 23, 'all expected shared-space access policies exist');
select is((
  select count(*)::integer from pg_policies
   where schemaname='public'
     and tablename='personal_shared_habits'
     and policyname='personal_shared_habits_update'
     and qual like '%personal_shared_is_owner%'
     and qual like '%created_by%'
), 1, 'shared habits can only be edited by their creator or a space owner');

select has_function('public','personal_shared_is_member','shared membership helper exists');
select has_function('public','personal_shared_is_owner','shared owner helper exists');
select has_function('public','accept_personal_shared_invite','invite acceptance checks the signed-in account');
select ok((
  select exists(select 1 from pg_trigger
    where tgrelid='public.personal_shared_spaces'::regclass
      and tgname='personal_shared_add_owner_member' and not tgisinternal)
), 'creating a shared space adds its owner as a member');
select ok((
  select exists(select 1 from pg_trigger
    where tgrelid='public.personal_shared_goal_contributions'::regclass
      and tgname='personal_shared_goal_contribution' and not tgisinternal)
), 'goal contributions update progress and award team points once');


select ok(
  not has_table_privilege('authenticated','public.personal_shared_goals','UPDATE'),
  'members cannot edit shared goal progress or rewards directly'
);
select is((
  select count(*)::integer from pg_policies
   where schemaname='public' and tablename='personal_shared_goals' and cmd='UPDATE'
), 0, 'shared goals have no direct member update policy');

-- Bible: per-user annual/free modes, legacy progress and book ownership.
select has_table('public','bible_reading_preferences','Bible reading preferences table exists');
select has_table('public','bible_reading_cycles','Bible reading cycles table exists');
select has_table('public','bible_reading_completions','legacy Bible completion history is retained');
select has_table('public','bible_free_readings','free-reading history table exists');
select has_table('public','bible_reading_day_progress','three-part daily Bible progress table exists');
select ok((
  select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public'
     and c.relname=any(array[
       'bible_reading_preferences','bible_reading_cycles','bible_reading_completions',
       'bible_free_readings','bible_reading_day_progress'
     ])
), 'all Bible reading tables have row-level security enabled');
select is((
  select count(*)::integer
    from pg_policies
   where schemaname='public'
     and tablename=any(array[
       'bible_reading_preferences','bible_reading_cycles','bible_reading_completions',
       'bible_free_readings','bible_reading_day_progress'
     ])
     and policyname in (
       'bible_reading_preferences_all_own',
       'bible_reading_cycles_all_own',
       'bible_reading_completions_all_own',
       'bible_free_readings_all_own',
       'bible_reading_day_progress_all_own'
     )
), 5, 'all Bible reading tables have owner-only policies');
select has_index('public','bible_reading_cycles','bible_reading_one_active_cycle_per_book','one active Bible cycle per book is enforced');
select has_column('public','bible_reading_cycles','learning_item_id','Bible cycles are linked to a learning book');
select has_column('public','bible_free_readings','passage','free readings store the passage');
select has_column('public','bible_free_readings','note','free readings store a note');
select has_column('public','bible_reading_day_progress','first_done','first daily Bible reading can be checked');
select has_column('public','bible_reading_day_progress','second_done','second daily Bible reading can be checked');
select has_column('public','bible_reading_day_progress','third_done','third daily Bible reading can be checked');
select has_function('public','ensure_bible_learning_item_owner','Bible entries must belong to the signed-in user book');
select ok((
  select exists(select 1 from pg_trigger
    where tgrelid='public.bible_reading_cycles'::regclass
      and tgname='bible_reading_cycles_validate_owner' and not tgisinternal)
), 'Bible cycles validate ownership of the linked book');
select ok((
  select exists(select 1 from pg_trigger
    where tgrelid='public.bible_free_readings'::regclass
      and tgname='bible_free_readings_validate_owner' and not tgisinternal)
), 'free Bible readings validate ownership of the linked book');


select ok((
  not has_function_privilege('anon','public.personal_shared_add_owner_member()','EXECUTE')
  and not has_function_privilege('authenticated','public.personal_shared_add_owner_member()','EXECUTE')
), 'shared-space owner trigger function cannot be executed directly');
select ok((
  not has_function_privilege('anon','public.personal_shared_apply_goal_contribution()','EXECUTE')
  and not has_function_privilege('authenticated','public.personal_shared_apply_goal_contribution()','EXECUTE')
), 'shared-goal reward trigger function cannot be executed directly');


select has_column('public','habits','icon','personal habits support custom icons');
select has_column('public','learning_items','cover_path','learning resources support private cover photos');
select has_column('public','learning_items','target_pages','books support intermediate page goals');
select has_column('public','learning_items','goal_description','games support a written goal');
select has_column('public','learning_items','goal_date','games support a target date');
select has_column('public','medications','stock_unit','medications track physical stock units');
select has_column('public','medications','units_per_dose','medications track units per dose');
select has_table('public','medication_stock_movements','medication stock refills are stored as movements');

select * from finish();
rollback;
