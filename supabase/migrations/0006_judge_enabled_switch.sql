-- kata: a database-side switch for the judge.
--
-- JUDGE_ENABLED only hides Run/Submit in the UI; enqueue_submission is also
-- reachable directly through the Supabase API, so with no worker deployed a
-- signed-in user could still queue jobs. The function now refuses unless
-- judge.settings has enabled = 1. Off by default.
--
--   on:  insert into judge.settings values ('enabled', 1)
--          on conflict (key) do update set value = excluded.value;
--   off: update judge.settings set value = 0 where key = 'enabled';
--
-- Everything else is unchanged from 0003.

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
  -- Off until a worker is running (and the kill switch when one isn't
  -- wanted): without it, jobs queued through the API would wait for a
  -- worker that doesn't exist, then all run at once when one starts.
  if judge.setting('enabled', 0) <> 1 then
    raise exception 'running code isn''t available right now'
      using errcode = 'KT503', hint = 'retry_after=300';
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
