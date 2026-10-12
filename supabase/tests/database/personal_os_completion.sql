begin;

select plan(40);

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
select is(
  public.gamification_xp_for_event('habit_logs', '{"habit_kind":"activity"}'::jsonb),
  0,
  'activities do not award habit XP'
);
select is(
  public.gamification_xp_for_event('habit_logs', '{"habit_kind":"habit"}'::jsonb),
  5,
  'habit logs retain their expected XP'
);

select is(
  public.gamification_xp_for_event('habit_logs', '{"_operation":"UPDATE","habit_kind":"habit"}'::jsonb),
  0,
  'editing an existing habit log does not award XP again'
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

-- Private media buckets must exist and be owned by per-user storage policies.
select ok((select exists(select 1 from storage.buckets where id = 'finance-photos' and public = false)), 'finance photo bucket exists and is private');
select ok((select exists(select 1 from storage.buckets where id = 'profile-media' and public = false)), 'profile media bucket exists and is private');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'pos_finance_photos_%'), 4, 'finance photo bucket has four per-user policies');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'pos_profile_media_%'), 4, 'profile media bucket has four per-user policies');
select ok((select exists(select 1 from pg_indexes where schemaname='public' and indexname='work_sessions_one_active_per_user_uidx')), 'only one active work session per user is enforced');

select * from finish();
rollback;
