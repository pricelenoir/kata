-- kata: per-user question progress.
-- Run this once in the Supabase dashboard's SQL Editor (Project > SQL Editor > New query).
-- auth.users already exists — Supabase Auth manages it, nothing to create there.

create table if not exists public.question_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  status text not null check (status in ('correct', 'incorrect')),
  selected_index int,
  attempted_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists question_attempts_user_id_idx
  on public.question_attempts (user_id);

alter table public.question_attempts enable row level security;

-- Each user can only ever see/write their own rows — this is the only
-- access control in the app; there is no server-side check beyond it.
create policy "select own attempts"
  on public.question_attempts for select
  using (auth.uid() = user_id);

create policy "insert own attempts"
  on public.question_attempts for insert
  with check (auth.uid() = user_id);

create policy "update own attempts"
  on public.question_attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own attempts"
  on public.question_attempts for delete
  using (auth.uid() = user_id);
