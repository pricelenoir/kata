-- kata: append-only attempt history.
--
-- question_attempts (0001) only keeps the latest attempt per question, so
-- every re-answer erased history — no accuracy-over-time, no spaced
-- repetition, and streaks computed from it lose days. Clients now write
-- only to question_attempt_events; a trigger keeps question_attempts as a
-- derived "latest attempt" view that clients can read but not write.

create table if not exists public.question_attempt_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) <= 200),
  status text not null check (status in ('correct', 'incorrect')),
  selected_index int,
  attempted_at timestamptz not null default now()
);

create index if not exists question_attempt_events_user_time_idx
  on public.question_attempt_events (user_id, attempted_at);

alter table public.question_attempt_events enable row level security;

create policy "select own attempt events"
  on public.question_attempt_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Past timestamps are allowed (anonymous progress is migrated with its
-- original times on first sign-in); future ones aren't. Grading itself is
-- still client-side, so status is self-reported — fine for personal
-- practice, but anything competitive must be graded server-side.
create policy "insert own attempt events"
  on public.question_attempt_events for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and attempted_at <= now() + interval '5 minutes'
  );

create policy "delete own attempt events"
  on public.question_attempt_events for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Seed history from whatever latest-attempt rows already exist.
insert into public.question_attempt_events
  (user_id, question_id, status, selected_index, attempted_at)
select user_id, question_id, status, selected_index, attempted_at
from public.question_attempts;

create or replace function public.apply_attempt_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.question_attempts
    (user_id, question_id, status, selected_index, attempted_at)
  values
    (new.user_id, new.question_id, new.status, new.selected_index, new.attempted_at)
  on conflict (user_id, question_id) do update
    set status = excluded.status,
        selected_index = excluded.selected_index,
        attempted_at = excluded.attempted_at
    where public.question_attempts.attempted_at <= excluded.attempted_at;
  return new;
end;
$$;

revoke all on function public.apply_attempt_event() from public, anon, authenticated;

create trigger question_attempt_events_apply
  after insert on public.question_attempt_events
  for each row execute function public.apply_attempt_event();

-- question_attempts is now derived: clients may read and delete their own
-- rows, but only the trigger above writes them.
drop policy if exists "insert own attempts" on public.question_attempts;
drop policy if exists "update own attempts" on public.question_attempts;

-- Distinct active dates in the caller's timezone, for streaks. Computed in
-- the database so the client doesn't have to download the whole history.
create or replace function public.activity_dates(tz text default 'UTC')
returns setof date
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct (e.attempted_at at time zone tz)::date as day
  from public.question_attempt_events e
  where e.user_id = (select auth.uid())
  order by day;
$$;

-- One call so a reset can't half-apply (history gone, latest rows left).
create or replace function public.reset_my_progress()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.question_attempt_events where user_id = (select auth.uid());
  delete from public.question_attempts where user_id = (select auth.uid());
$$;

revoke all on function public.activity_dates(text) from public, anon;
revoke all on function public.reset_my_progress() from public, anon;
grant execute on function public.activity_dates(text) to authenticated;
grant execute on function public.reset_my_progress() to authenticated;
