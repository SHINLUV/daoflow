-- Journal runtime repairs. Apply after the already-applied 001-006 history.

create or replace function public.purge_entry(p_id uuid, p_version integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
  v_entry public.journal_entries;
begin
  select * into v_entry
  from public.journal_entries
  where id = p_id and user_id = v_user_id
  for update;
  if not found then raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_version is null or p_version <> v_entry.version then raise exception 'CAS_CONFLICT' using errcode = 'P0001'; end if;
  if v_entry.deleted_at is null then raise exception 'PURGE_REQUIRES_RECYCLED_ENTRY' using errcode = 'P0001'; end if;
  delete from public.journal_entries where id = p_id and user_id = v_user_id and version = p_version;
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
  select * into v_volume from public.journal_volumes where id = p_id and user_id = v_user_id;
  if found then
    if v_volume.title = v_title then return v_volume; end if;
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;
  insert into public.journal_volumes (id, user_id, title)
  values (p_id, v_user_id, v_title)
  on conflict (id) do nothing
  returning * into v_volume;
  if found then return v_volume; end if;
  select * into v_volume from public.journal_volumes where id = p_id and user_id = v_user_id;
  if not found then raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_volume.title = v_title then return v_volume; end if;
  raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
end;
$$;

revoke all on function public.purge_entry(uuid, integer) from public, anon;
revoke all on function public.create_volume(uuid, text) from public, anon;
grant execute on function public.purge_entry(uuid, integer) to authenticated;
grant execute on function public.create_volume(uuid, text) to authenticated;
