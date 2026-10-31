-- Local development only (`supabase start` / `supabase db reset`); never
-- applied to a hosted project. Lets a locally run worker log in:
--   JUDGE_DATABASE_URL=postgresql://judge_worker:judge-local-dev@127.0.0.1:54322/postgres
alter role judge_worker with login password 'judge-local-dev';

-- A ready-made local login (dev@kata.test / kata-local-dev).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'dev@kata.test',
  extensions.crypt('kata-local-dev', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values (
  gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","email":"dev@kata.test","email_verified":true}',
  'email', now(), now()
) on conflict do nothing;
