-- Submissions, rate limits, and the worker API (0003_submissions.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- pgTAP's assertion functions live in `extensions`; let the worker role
-- call them for the duration of this (rolled-back) transaction.
grant usage on schema extensions to judge_worker;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- ---- clients ----

set local role anon;
select throws_ok(
  $$ select public.enqueue_submission('spin-lock', 'cpp', 'run', 'int main(){}') $$,
  '42501', null, 'anon cannot enqueue'
);
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select isnt(
  public.enqueue_submission('spin-lock', 'cpp', 'run', 'int main(){}'),
  null, 'a signed-in user can enqueue'
);

select throws_ok(
  $$ select public.enqueue_submission('spin-lock', 'python', 'run', 'print(1)') $$,
  '23514', null, 'unsupported languages are rejected'
);

select throws_ok(
  $$ select public.enqueue_submission('spin-lock', 'cpp', 'submit', 'x', '{"stdin":""}') $$,
  'KT400', null, 'custom input is only allowed on runs'
);

select throws_ok(
  $$ select public.enqueue_submission('spin-lock', 'cpp', 'run', repeat('x', 70000)) $$,
  '23514', null, 'oversized source is rejected'
);

select public.enqueue_submission('spin-lock', 'rust', 'submit', 'fn main(){}');
select throws_ok(
  $$ select public.enqueue_submission('spin-lock', 'cpp', 'run', 'int main(){}') $$,
  'KT429', null, 'at most two submissions in flight per user'
);

select throws_ok(
  $$ insert into public.submissions (user_id, exercise_id, language, kind, source)
     values ('11111111-1111-1111-1111-111111111111', 'x', 'cpp', 'run', 'x') $$,
  '42501', null, 'clients cannot insert directly'
);

select is(
  (select count(*)::int from public.submissions),
  2, 'a user sees their own submissions'
);

select throws_ok(
  $$ update public.submissions set verdict = 'accepted' $$,
  '42501', null, 'clients cannot forge verdicts'
);

reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.submissions),
  0, 'other users'' submissions are invisible'
);
select throws_ok(
  $$ select * from judge.claim_job('evil') $$,
  '42501', null, 'clients cannot call the worker API'
);
select throws_ok(
  $$ select * from judge.get_bundle('spin-lock') $$,
  '42501', null, 'clients cannot read hidden test bundles'
);

-- ---- per-minute limit (with in-flight lifted so it's what trips) ----
reset role;
insert into judge.settings values ('max_in_flight_per_user', 100), ('max_per_minute', 3);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.enqueue_submission('spin-lock', 'cpp', 'run', 'a');
select public.enqueue_submission('spin-lock', 'cpp', 'run', 'b');
select public.enqueue_submission('spin-lock', 'cpp', 'run', 'c');
select throws_ok(
  $$ select public.enqueue_submission('spin-lock', 'cpp', 'run', 'd') $$,
  'KT429', 'too many runs in the last minute', 'per-minute rate limit'
);
reset role;
delete from judge.settings;

-- ---- worker ----
set local role judge_worker;

select is(
  (select exercise_id from judge.claim_job('w1')),
  'spin-lock', 'the worker claims the oldest queued job'
);

select is(
  (select count(*)::int from judge.claim_job('w2') c
     where c.id in (select id from judge.claim_job('w3'))),
  0, 'a claimed job is not handed out again while its lease is live'
);

select throws_ok(
  $$ select * from public.submissions $$,
  '42501', null, 'the worker role cannot read tables directly'
);

reset role;
select is(
  (select status from public.submissions where worker_id = 'w1'),
  'running', 'a claimed job is running'
);

set local role judge_worker;
select is(
  judge.complete_job(gen_random_uuid(), 'w1', '{}'::jsonb),
  null, 'completing a job the worker does not hold is a no-op'
);
reset role;

-- complete w1's job as w1
select is(
  (select judge.complete_job(id, 'w1',
     '{"verdict":"accepted","passed":7,"total":7,"timeMs":12,"memoryKb":3000,"tests":[]}')
   from public.submissions where worker_id = 'w1'),
  true, 'the claiming worker can complete its job'
);
select is(
  (select status || '/' || verdict || '/' || passed from public.submissions where worker_id = 'w1'),
  'done/accepted/7', 'completion records the verdict'
);

-- a lease that expired three times becomes an internal error
update public.submissions set status = 'running', worker_id = 'gone',
  lease_expires_at = now() - interval '1 minute', attempts = 3
  where worker_id is null;
set local role judge_worker;
select * from judge.claim_job('w4');
reset role;
select ok(
  (select bool_and(status = 'error' and verdict = 'internal_error')
     from public.submissions where worker_id = 'gone'),
  'jobs that keep losing their worker are failed, not retried forever'
);

select * from finish();
rollback;
