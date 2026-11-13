begin;

select plan(6);

create temporary table xp_hist_test_user(user_id uuid not null);

do $test$
declare
  test_user uuid := gen_random_uuid();
  test_book uuid := gen_random_uuid();
begin
  insert into auth.users(
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    test_user,
    'authenticated',
    'authenticated',
    'xp-historical-test-' || test_user::text || '@example.com',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into pg_temp.xp_hist_test_user(user_id) values (test_user);

  -- Insertar como si fueran datos antiguos, sin ejecutar los triggers actuales.
  alter table public.finance_transactions disable trigger user;
  alter table public.hydration_entries disable trigger user;
  alter table public.learning_items disable trigger user;
  alter table public.language_profiles disable trigger user;

  insert into public.finance_transactions(user_id, type, amount, occurred_on)
  values (test_user, 'expense', 25000, current_date - 10);

  insert into public.learning_items(
    id, user_id, title, kind, status, completed_on
  ) values (
    test_book, test_user, 'Libro histórico de prueba', 'book', 'completed', current_date - 8
  );

  insert into public.language_profiles(
    user_id, language_code, language_name, level
  ) values (
    test_user, 'en', 'Inglés', 'B1'
  );

  insert into public.hydration_entries(user_id, consumed_on, beverage_type, amount_ml)
  values
    (test_user, current_date - 9, 'water', 1000),
    (test_user, current_date - 9, 'water', 1000);

  alter table public.finance_transactions enable trigger user;
  alter table public.hydration_entries enable trigger user;
  alter table public.learning_items enable trigger user;
  alter table public.language_profiles enable trigger user;
end;
$test$;

select is(
  public.backfill_historical_gamification_xp(),
  62,
  'credits the historical transaction, completed book, current language level, water goal and first-action achievement'
);

select is(
  (select sum(xp)::integer
     from public.gamification_xp_events
    where user_id = (select user_id from pg_temp.xp_hist_test_user)),
  62,
  'the XP ledger contains the expected total'
);

select is(
  (select count(*)::integer
     from public.gamification_xp_events
    where user_id = (select user_id from pg_temp.xp_hist_test_user)),
  5,
  'each historical action and milestone creates only one ledger entry'
);

select ok(
  exists (
    select 1
      from public.gamification_achievements
     where user_id = (select user_id from pg_temp.xp_hist_test_user)
       and code = 'first_book_finished'
       and unlocked_at is not null
  ),
  'a completed historical book unlocks its trophy'
);

select is(
  public.backfill_historical_gamification_xp(),
  0,
  'running the backfill a second time does not award duplicate XP'
);

select is(
  (select gp.xp
     from public.gamification_profiles gp
    where gp.user_id = (select user_id from pg_temp.xp_hist_test_user)),
  (select sum(ge.xp)::integer
     from public.gamification_xp_events ge
    where ge.user_id = (select user_id from pg_temp.xp_hist_test_user)),
  'the profile XP total matches its event ledger'
);

select * from finish();

rollback;
