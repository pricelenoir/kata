-- kata: self-service account deletion.
--
-- Deleting the auth.users row cascades to everything the user owns
-- (attempts, attempt history, submissions) through the existing foreign
-- keys, and to their sessions and identities inside the auth schema. Doing
-- it in a function keeps the service-role key off the web tier entirely.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
