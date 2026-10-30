-- RLS + trigger behavior for attempt history (0002_attempt_events.sql).
-- Run with `supabase test db` against a local stack.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- user A records two attempts on the same question
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

insert into public.question_attempt_events (user_id, question_id, status, attempted_at)
values ('11111111-1111-1111-1111-111111111111', 'q1', 'incorrect', now() - interval '2 days');
insert into public.question_attempt_events (user_id, question_id, status, attempted_at)
values ('11111111-1111-1111-1111-111111111111', 'q1', 'correct', now() - interval '1 day');

select is(
  (select status from public.question_attempts where question_id = 'q1'),
  'correct',
  'trigger keeps the latest attempt in question_attempts'
);

-- an older event (e.g. migrated local progress) must not clobber a newer one
insert into public.question_attempt_events (user_id, question_id, status, attempted_at)
values ('11111111-1111-1111-1111-111111111111', 'q1', 'incorrect', now() - interval '30 days');

select is(
  (select status from public.question_attempts where question_id = 'q1'),
  'correct',
  'older events do not overwrite a newer latest attempt'
);

select is(
  (select count(*)::int from public.question_attempt_events),
  3,
  'every attempt is kept in history'
);

select is(
  (select count(*)::int from public.activity_dates('UTC')),
  3,
  'activity_dates returns one row per distinct day'
);

select throws_ok(
  $$ insert into public.question_attempts (user_id, question_id, status)
     values ('11111111-1111-1111-1111-111111111111', 'q2', 'correct') $$,
  '42501',
  null,
  'clients cannot write question_attempts directly'
);

select throws_ok(
  $$ insert into public.question_attempt_events (user_id, question_id, status, attempted_at)
     values ('11111111-1111-1111-1111-111111111111', 'q3', 'correct', now() + interval '1 day') $$,
  '42501',
  null,
  'future-dated attempts are rejected'
);

select throws_ok(
  $$ insert into public.question_attempt_events (user_id, question_id, status)
     values ('22222222-2222-2222-2222-222222222222', 'q1', 'correct') $$,
  '42501',
  null,
  'cannot record attempts as another user'
);

-- user B sees nothing of A's
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

insert into public.question_attempt_events (user_id, question_id, status)
values ('22222222-2222-2222-2222-222222222222', 'q9', 'correct');

select is(
  (select count(*)::int from public.question_attempt_events),
  1,
  'users only see their own history'
);

select is(
  (select count(*)::int from public.question_attempts),
  1,
  'users only see their own latest attempts'
);

-- B resetting must not touch A
select public.reset_my_progress();

select is(
  (select count(*)::int from public.question_attempt_events),
  0,
  'reset clears the caller''s history'
);

reset role;

select is(
  (select count(*)::int from public.question_attempt_events
     where user_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'reset leaves other users alone'
);

-- anonymous callers get nothing
set local role anon;
select throws_ok(
  $$ select public.activity_dates('UTC') $$,
  '42501',
  null,
  'anon cannot call activity_dates'
);

select * from finish();
rollback;
