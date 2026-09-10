-- Keep the public profile lifecycle aligned with Supabase Auth.
-- Earlier installations created this foreign key without a delete action,
-- which prevents the Auth admin API from deleting a user.

alter table public.users
  drop constraint if exists users_id_fkey;

alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
