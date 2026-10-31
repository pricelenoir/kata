-- Self-service account deletion (0004_delete_account.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');
insert into public.question_attempt_events (user_id, question_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'q1', 'correct'),
  ('22222222-2222-2222-2222-222222222222', 'q1', 'correct');
insert into public.submissions (user_id, exercise_id, language, kind, source) values
  ('11111111-1111-1111-1111-111111111111', 'spin-lock', 'cpp', 'run', 'x');

set local role anon;
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot call it');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'a user can delete their own account');
reset role;

select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0, 'the auth user is gone');
select is(
  (select count(*)::int from public.question_attempt_events where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.question_attempts where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.submissions where user_id = '11111111-1111-1111-1111-111111111111'),
  0, 'their history and submissions cascade away'
);
select is((select count(*)::int from auth.users where id = '22222222-2222-2222-2222-222222222222'), 1, 'other users are untouched');

select * from finish();
rollback;
