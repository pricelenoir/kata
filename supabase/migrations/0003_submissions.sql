-- kata: code submissions and the judge queue.
--
-- Flow: the browser calls public.enqueue_submission() (rate-limited, runs as
-- the table owner), which inserts a queued row and NOTIFYs workers. A judge
-- worker — connecting as the judge_worker role, which can do nothing but
-- call the judge.* functions below — claims the job, runs it in a sandbox,
-- and writes the result back. The browser watches its own row over
-- Realtime. Users can read their own submissions and nothing else; no
-- client can insert, update, or delete rows directly.
--
-- Hidden test bundles live in judge.test_bundles. The judge schema isn't
-- exposed through the API, and only the worker role can read bundles.

create schema if not exists judge;
revoke all on schema judge from public;

-- ---------------------------------------------------------------------------
-- Submissions

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) <= 100),
  language text not null check (language in ('cpp', 'rust')),
  kind text not null check (kind in ('run', 'submit')),
  -- Runner pool that can execute this job (CUDA will need 'gpu').
  pool text not null default 'cpu',
  source text not null check (octet_length(source) <= 65536),
  custom_input jsonb check (custom_input is null or octet_length(custom_input::text) <= 65536),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  verdict text check (verdict in (
    'accepted', 'wrong_answer', 'time_limit', 'memory_limit',
    'runtime_error', 'compile_error', 'output_limit', 'internal_error'
  )),
  result jsonb,
  passed int,
  total int,
  time_ms int,
  memory_kb int,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  -- Worker bookkeeping.
  attempts int not null default 0,
  worker_id text,
  lease_expires_at timestamptz
);

create index if not exists submissions_user_exercise_idx
  on public.submissions (user_id, exercise_id, created_at desc);
create index if not exists submissions_user_created_idx
  on public.submissions (user_id, created_at desc);
create index if not exists submissions_queue_idx
  on public.submissions (pool, created_at)
  where status in ('queued', 'running');

alter table public.submissions enable row level security;

create policy "select own submissions"
  on public.submissions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Belt and braces on top of RLS (which has no write policies at all).
revoke insert, update, delete on public.submissions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Limits (rows override the defaults in enqueue_submission)

create table if not exists judge.settings (
  key text primary key,
  value int not null
);

create or replace function judge.setting(p_key text, p_default int)
returns int
language sql
stable
set search_path = ''
as $$
  select coalesce((select value from judge.settings where key = p_key), p_default);
$$;

-- ---------------------------------------------------------------------------
-- Enqueue (the only way submissions are created)

create or replace function public.enqueue_submission(
  p_exercise_id text,
  p_language text,
  p_kind text,
  p_source text,
  p_custom_input jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  last_minute int;
  last_day int;
  in_flight int;
  queued int;
  new_id uuid;
begin
  if uid is null then
    raise exception 'sign in to run code' using errcode = '28000';
  end if;
  if p_kind not in ('run', 'submit') then
    raise exception 'kind must be run or submit' using errcode = 'KT400';
  end if;
  if p_kind = 'submit' and p_custom_input is not null then
    raise exception 'custom input is only for runs' using errcode = 'KT400';
  end if;

  -- One enqueue at a time per user, so the counts below can't race.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select
    count(*) filter (where created_at > now() - interval '1 minute'),
    count(*) filter (where created_at > now() - interval '1 day'),
    count(*) filter (where status in ('queued', 'running'))
  into last_minute, last_day, in_flight
  from public.submissions
  where user_id = uid and created_at > now() - interval '1 day';

  if in_flight >= judge.setting('max_in_flight_per_user', 2) then
    raise exception 'wait for your current run to finish'
      using errcode = 'KT429', hint = 'retry_after=5';
  end if;
  if last_minute >= judge.setting('max_per_minute', 10) then
    raise exception 'too many runs in the last minute'
      using errcode = 'KT429', hint = 'retry_after=60';
  end if;
  if last_day >= judge.setting('max_per_day', 300) then
    raise exception 'daily limit reached'
      using errcode = 'KT429', hint = 'retry_after=3600';
  end if;

  select count(*) into queued from public.submissions where status = 'queued';
  if queued >= judge.setting('max_queue_depth', 500) then
    raise exception 'the judge is busy, try again shortly'
      using errcode = 'KT503', hint = 'retry_after=15';
  end if;

  insert into public.submissions (user_id, exercise_id, language, kind, source, custom_input)
  values (uid, p_exercise_id, p_language, p_kind, p_source, p_custom_input)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.enqueue_submission(text, text, text, text, jsonb) from public, anon;
grant execute on function public.enqueue_submission(text, text, text, text, jsonb) to authenticated;

create or replace function judge.notify_queued()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_notify('judge_jobs', new.pool);
  return new;
end;
$$;

create trigger submissions_notify_queued
  after insert on public.submissions
  for each row execute function judge.notify_queued();

-- ---------------------------------------------------------------------------
-- Hidden test bundles (published from the private repository)

create table if not exists judge.test_bundles (
  exercise_id text primary key,
  version text not null,
  bundle jsonb not null,
  published_at timestamptz not null default now()
);

create or replace function judge.publish_bundle(p_exercise_id text, p_bundle jsonb)
returns text
language sql
set search_path = ''
as $$
  insert into judge.test_bundles (exercise_id, version, bundle)
  values (p_exercise_id, encode(sha256(convert_to(p_bundle::text, 'UTF8')), 'hex'), p_bundle)
  on conflict (exercise_id) do update
    set version = excluded.version, bundle = excluded.bundle, published_at = now()
  returning version;
$$;

revoke all on function judge.publish_bundle(text, jsonb) from public;

create or replace function judge.get_bundle(p_exercise_id text)
returns table (version text, bundle jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select b.version, b.bundle from judge.test_bundles b where b.exercise_id = p_exercise_id;
$$;

-- ---------------------------------------------------------------------------
-- Worker API

create or replace function judge.claim_job(
  p_worker text,
  p_pool text default 'cpu',
  p_lease_seconds int default 60
)
returns table (
  id uuid,
  exercise_id text,
  language text,
  kind text,
  source text,
  custom_input jsonb,
  attempts int
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Jobs whose worker died three times are failed, not retried forever.
  update public.submissions s
  set status = 'error',
      verdict = 'internal_error',
      result = jsonb_build_object(
        'verdict', 'internal_error', 'passed', 0, 'total', 0, 'timeMs', 0,
        'memoryKb', 0, 'tests', '[]'::jsonb,
        'message', 'The judge failed to finish this submission.'),
      finished_at = now(),
      lease_expires_at = null
  where s.pool = p_pool
    and s.status = 'running'
    and s.lease_expires_at < now()
    and s.attempts >= 3;

  return query
  update public.submissions s
  set status = 'running',
      started_at = coalesce(s.started_at, now()),
      attempts = s.attempts + 1,
      worker_id = p_worker,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where s.id = (
    select q.id
    from public.submissions q
    where q.pool = p_pool
      and (q.status = 'queued' or (q.status = 'running' and q.lease_expires_at < now()))
    order by q.created_at
    limit 1
    for update skip locked
  )
  returning s.id, s.exercise_id, s.language, s.kind, s.source, s.custom_input, s.attempts;
end;
$$;

create or replace function judge.extend_lease(p_id uuid, p_worker text, p_lease_seconds int default 60)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.submissions
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where id = p_id and worker_id = p_worker and status = 'running'
  returning true;
$$;

create or replace function judge.complete_job(p_id uuid, p_worker text, p_result jsonb)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.submissions
  set status = case when p_result->>'verdict' = 'internal_error' then 'error' else 'done' end,
      verdict = p_result->>'verdict',
      result = p_result,
      passed = (p_result->>'passed')::int,
      total = (p_result->>'total')::int,
      time_ms = (p_result->>'timeMs')::int,
      memory_kb = (p_result->>'memoryKb')::int,
      finished_at = now(),
      lease_expires_at = null
  where id = p_id and worker_id = p_worker and status = 'running'
  returning true;
$$;

-- The worker role: log in (password set out of band), call these, nothing
-- else. A compromised runner host can read hidden tests and write results,
-- but can't touch accounts, progress, or anything outside the queue.
do $$
begin
  if not exists (select from pg_roles where rolname = 'judge_worker') then
    create role judge_worker nologin;
  end if;
end;
$$;
-- Lets the admin role act as the worker (tests, manual debugging).
grant judge_worker to postgres;

revoke all on function judge.claim_job(text, text, int) from public;
revoke all on function judge.extend_lease(uuid, text, int) from public;
revoke all on function judge.complete_job(uuid, text, jsonb) from public;
revoke all on function judge.get_bundle(text) from public;
revoke all on function judge.setting(text, int) from public;
revoke all on function judge.notify_queued() from public;
grant usage on schema judge to judge_worker;
grant execute on function judge.claim_job(text, text, int) to judge_worker;
grant execute on function judge.extend_lease(uuid, text, int) to judge_worker;
grant execute on function judge.complete_job(uuid, text, jsonb) to judge_worker;
grant execute on function judge.get_bundle(text) to judge_worker;

-- ---------------------------------------------------------------------------
-- Live updates for the submitting user (Realtime applies the select policy).

do $$
begin
  if exists (select from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.submissions;
  end if;
end;
$$;
