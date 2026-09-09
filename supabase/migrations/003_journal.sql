-- DaoFlow V2 journal foundation.  Apply only to an isolated local Supabase project.
-- This migration intentionally does not alter the historical 001/002 migrations.

create table public.journal_volumes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(60) not null check (char_length(btrim(title)) between 1 and 60),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  unique (user_id, id)
);

create table public.journal_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  volume_id uuid,
  title varchar(60),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  mood text check (mood is null or mood in ('calm', 'uneasy', 'sad', 'angry', 'hopeful', 'mixed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  foreign key (user_id, volume_id) references public.journal_volumes(user_id, id)
);

create table public.journal_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_volume_id uuid,
  updated_at timestamptz not null default now(),
  foreign key (user_id, last_volume_id) references public.journal_volumes(user_id, id)
);

create index journal_entries_user_created_idx on public.journal_entries(user_id, created_at desc, id desc);
create index journal_entries_user_volume_created_idx on public.journal_entries(user_id, volume_id, created_at, id);
create index journal_volumes_user_updated_idx on public.journal_volumes(user_id, updated_at desc, id);

alter table public.journal_volumes enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_preferences enable row level security;

create policy journal_volumes_select_own on public.journal_volumes for select to authenticated using (auth.uid() = user_id);
create policy journal_entries_select_own on public.journal_entries for select to authenticated using (auth.uid() = user_id);
create policy journal_preferences_select_own on public.journal_preferences for select to authenticated using (auth.uid() = user_id);

revoke all on table public.journal_volumes, public.journal_entries, public.journal_preferences from public, anon, authenticated;
grant select on table public.journal_volumes, public.journal_entries, public.journal_preferences to authenticated;

create or replace function public.require_journal_user()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  return v_user_id;
end;
$$;

create or replace function public.create_entry(
  p_id uuid,
  p_body text,
  p_title text default null,
  p_mood text default null,
  p_volume_id uuid default null
)
returns public.journal_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
  v_entry public.journal_entries;
  v_body text := btrim(coalesce(p_body, ''));
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if p_id is null or char_length(v_body) not between 1 and 10000 then
    raise exception 'INVALID_ENTRY' using errcode = '22023';
  end if;
  if v_title is not null and char_length(v_title) > 60 then
    raise exception 'INVALID_TITLE' using errcode = '22023';
  end if;
  if p_mood is not null and p_mood not in ('calm', 'uneasy', 'sad', 'angry', 'hopeful', 'mixed') then
    raise exception 'INVALID_MOOD' using errcode = '22023';
  end if;
  if p_volume_id is not null and not exists (
    select 1 from public.journal_volumes v
    where v.id = p_volume_id and v.user_id = v_user_id and v.archived_at is null
  ) then
    raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_entry from public.journal_entries where id = p_id;
  if found then
    if v_entry.user_id <> v_user_id then
      raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0002';
    end if;
    if v_entry.body = v_body
       and v_entry.title is not distinct from v_title
       and v_entry.mood is not distinct from p_mood
       and v_entry.volume_id is not distinct from p_volume_id then
      return v_entry;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;

  -- The client UUID is the idempotency key.  DO NOTHING absorbs a concurrent
  -- identical retry instead of leaking the primary-key race as a 500.
  insert into public.journal_entries (id, user_id, body, title, mood, volume_id)
  values (p_id, v_user_id, v_body, v_title, p_mood, p_volume_id)
  on conflict (id) do nothing
  returning * into v_entry;
  if found then
    return v_entry;
  end if;

  -- In READ COMMITTED this is a new statement after the conflict wait, so the
  -- winning concurrent row is visible here.  Keep the owner and full payload
  -- comparison: a UUID collision must never expose another user's content.
  select * into v_entry from public.journal_entries where id = p_id;
  if not found or v_entry.user_id <> v_user_id then
    raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_entry.body = v_body
     and v_entry.title is not distinct from v_title
     and v_entry.mood is not distinct from p_mood
     and v_entry.volume_id is not distinct from p_volume_id then
    return v_entry;
  end if;
  raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
end;
$$;

create or replace function public.patch_entry(
  p_id uuid,
  p_version integer,
  p_body text default null,
  p_body_set boolean default false,
  p_title text default null,
  p_title_set boolean default false,
  p_mood text default null,
  p_mood_set boolean default false,
  p_volume_id uuid default null,
  p_volume_set boolean default false,
  p_deleted boolean default null,
  p_deleted_set boolean default false
)
returns public.journal_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
  v_entry public.journal_entries;
  v_body text;
  v_title text;
begin
  select * into v_entry from public.journal_entries where id = p_id and user_id = v_user_id;
  if not found then
    raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_version is null or p_version <> v_entry.version then
    raise exception 'CAS_CONFLICT' using errcode = 'P0001';
  end if;
  if p_deleted_set and (p_body_set or p_title_set or p_mood_set or p_volume_set) then
    raise exception 'INVALID_ENTRY_PATCH' using errcode = '22023';
  end if;
  if v_entry.deleted_at is not null and not (p_deleted_set and p_deleted = false) then
    raise exception 'ENTRY_RECYCLED' using errcode = 'P0001';
  end if;

  v_body := case when p_body_set then btrim(coalesce(p_body, '')) else v_entry.body end;
  v_title := case when p_title_set then nullif(btrim(coalesce(p_title, '')), '') else v_entry.title end;
  if char_length(v_body) not between 1 and 10000 or (v_title is not null and char_length(v_title) > 60) then
    raise exception 'INVALID_ENTRY' using errcode = '22023';
  end if;
  if p_mood_set and p_mood is not null and p_mood not in ('calm', 'uneasy', 'sad', 'angry', 'hopeful', 'mixed') then
    raise exception 'INVALID_MOOD' using errcode = '22023';
  end if;
  if p_volume_set and p_volume_id is not null and not exists (
    select 1 from public.journal_volumes v
    where v.id = p_volume_id and v.user_id = v_user_id and v.archived_at is null
  ) then
    raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.journal_entries
  set body = v_body,
      title = v_title,
      mood = case when p_mood_set then p_mood else mood end,
      volume_id = case when p_volume_set then p_volume_id else volume_id end,
      deleted_at = case when p_deleted_set and p_deleted then now() when p_deleted_set and not p_deleted then null else deleted_at end,
      updated_at = now(),
      version = version + 1
  where id = p_id and user_id = v_user_id and version = p_version
  returning * into v_entry;
  if not found then
    raise exception 'CAS_CONFLICT' using errcode = 'P0001';
  end if;
  return v_entry;
end;
$$;

create or replace function public.purge_entry(p_id uuid, p_version integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
begin
  delete from public.journal_entries
  where id = p_id and user_id = v_user_id and version = p_version and deleted_at is not null;
  if not found then
    if exists (select 1 from public.journal_entries where id = p_id and user_id = v_user_id) then
      raise exception 'PURGE_REQUIRES_RECYCLED_ENTRY' using errcode = 'P0001';
    end if;
    raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.create_volume(p_id uuid, p_title text)
returns public.journal_volumes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
  v_title text := btrim(coalesce(p_title, ''));
  v_volume public.journal_volumes;
begin
  if p_id is null or char_length(v_title) not between 1 and 60 then
    raise exception 'INVALID_VOLUME' using errcode = '22023';
  end if;
  select * into v_volume from public.journal_volumes where id = p_id;
  if found then
    if v_volume.user_id = v_user_id and v_volume.title = v_title then return v_volume; end if;
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;
  insert into public.journal_volumes (id, user_id, title) values (p_id, v_user_id, v_title) returning * into v_volume;
  return v_volume;
end;
$$;

create or replace function public.patch_volume(
  p_id uuid,
  p_version integer,
  p_title text default null,
  p_title_set boolean default false,
  p_archived boolean default null,
  p_archived_set boolean default false
)
returns public.journal_volumes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
  v_volume public.journal_volumes;
  v_title text;
begin
  select * into v_volume from public.journal_volumes where id = p_id and user_id = v_user_id;
  if not found then raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_version is null or p_version <> v_volume.version then raise exception 'CAS_CONFLICT' using errcode = 'P0001'; end if;
  v_title := case when p_title_set then btrim(coalesce(p_title, '')) else v_volume.title end;
  if char_length(v_title) not between 1 and 60 then raise exception 'INVALID_VOLUME' using errcode = '22023'; end if;
  update public.journal_volumes
  set title = v_title,
      archived_at = case when p_archived_set and p_archived then now() when p_archived_set and not p_archived then null else archived_at end,
      updated_at = now(), version = version + 1
  where id = p_id and user_id = v_user_id and version = p_version
  returning * into v_volume;
  if not found then raise exception 'CAS_CONFLICT' using errcode = 'P0001'; end if;
  return v_volume;
end;
$$;

create or replace function public.set_journal_preferences(p_last_volume_id uuid)
returns public.journal_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
  v_preferences public.journal_preferences;
begin
  if p_last_volume_id is not null and not exists (
    select 1 from public.journal_volumes v where v.id = p_last_volume_id and v.user_id = v_user_id and v.archived_at is null
  ) then
    raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.journal_preferences (user_id, last_volume_id)
  values (v_user_id, p_last_volume_id)
  on conflict (user_id) do update set last_volume_id = excluded.last_volume_id, updated_at = now()
  returning * into v_preferences;
  return v_preferences;
end;
$$;

revoke all on function public.require_journal_user() from public, anon, authenticated;
revoke all on function public.create_entry(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.patch_entry(uuid, integer, text, boolean, text, boolean, text, boolean, uuid, boolean, boolean, boolean) from public, anon;
revoke all on function public.purge_entry(uuid, integer) from public, anon;
revoke all on function public.create_volume(uuid, text) from public, anon;
revoke all on function public.patch_volume(uuid, integer, text, boolean, boolean, boolean) from public, anon;
revoke all on function public.set_journal_preferences(uuid) from public, anon;
grant execute on function public.require_journal_user() to authenticated;
grant execute on function public.create_entry(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.patch_entry(uuid, integer, text, boolean, text, boolean, text, boolean, uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.purge_entry(uuid, integer) to authenticated;
grant execute on function public.create_volume(uuid, text) to authenticated;
grant execute on function public.patch_volume(uuid, integer, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.set_journal_preferences(uuid) to authenticated;
