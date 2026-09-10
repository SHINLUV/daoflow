-- Make account deletion deterministic across the legacy and V2 data graphs.
-- Ownership rows follow their owner; optional links are cleared when their
-- referenced entry, volume, or saved session disappears.

alter table public.ask_sessions drop constraint if exists ask_sessions_user_id_fkey;
alter table public.ask_sessions
  add constraint ask_sessions_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.favorites drop constraint if exists favorites_user_id_fkey;
alter table public.favorites
  add constraint favorites_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.journal_entries drop constraint if exists journal_entries_user_id_volume_id_fkey;
alter table public.journal_entries
  add constraint journal_entries_user_id_volume_id_fkey
  foreign key (user_id, volume_id) references public.journal_volumes(user_id, id)
  on delete set null (volume_id);

alter table public.journal_preferences drop constraint if exists journal_preferences_user_id_last_volume_id_fkey;
alter table public.journal_preferences
  add constraint journal_preferences_user_id_last_volume_id_fkey
  foreign key (user_id, last_volume_id) references public.journal_volumes(user_id, id)
  on delete set null (last_volume_id);

alter table public.ask_sessions drop constraint if exists ask_sessions_volume_owner_fkey;
alter table public.ask_sessions
  add constraint ask_sessions_volume_owner_fkey
  foreign key (user_id, volume_id) references public.journal_volumes(user_id, id)
  on delete set null (volume_id);

alter table public.journal_ask_requests drop constraint if exists journal_ask_requests_user_id_volume_id_fkey;
alter table public.journal_ask_requests
  add constraint journal_ask_requests_user_id_volume_id_fkey
  foreign key (user_id, volume_id) references public.journal_volumes(user_id, id)
  on delete set null (volume_id);

alter table public.journal_ask_requests drop constraint if exists journal_ask_requests_user_id_session_id_fkey;
alter table public.journal_ask_requests
  add constraint journal_ask_requests_user_id_session_id_fkey
  foreign key (user_id, session_id) references public.ask_sessions(user_id, id)
  on delete set null (session_id);
