-- DaoFlow V2 T04. Apply after 003_journal.sql. Do not apply to a remote production database.
-- The chapters table is the database-side trusted source; the application also validates
-- against its bundled chapters.json before it asks these functions to write.

create table if not exists public.journal_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id smallint not null references public.chapters(id),
  excerpt text not null check (length(btrim(excerpt)) > 0),
  note text null check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  constraint journal_favorites_chapter_range check (chapter_id between 1 and 81),
  constraint journal_favorites_user_chapter_excerpt_unique unique (user_id, chapter_id, excerpt)
);

create index if not exists journal_favorites_user_created_id_idx
  on public.journal_favorites (user_id, created_at desc, id desc);

alter table public.journal_favorites enable row level security;

revoke all on table public.journal_favorites from public, anon, authenticated;
grant select on table public.journal_favorites to authenticated;

drop policy if exists journal_favorites_owner_select on public.journal_favorites;
create policy journal_favorites_owner_select on public.journal_favorites
  for select to authenticated using (auth.uid() = user_id);

-- Keep the legacy table untouched. A legacy favorite represented a whole chapter, so its
-- canonical excerpt is copied from public.chapters. Re-running this migration is harmless.
insert into public.journal_favorites (user_id, chapter_id, excerpt, note)
select legacy.user_id, legacy.chapter_id, chapter.original_text, null
from public.favorites as legacy
join public.chapters as chapter on chapter.id = legacy.chapter_id
where legacy.user_id is not null
  and legacy.chapter_id between 1 and 81
on conflict (user_id, chapter_id, excerpt) do nothing;

create or replace function public.create_favorite(
  p_id uuid,
  p_chapter_id smallint,
  p_excerpt text,
  p_note text default null
)
returns setof public.journal_favorites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
  v_original text;
  v_existing public.journal_favorites%rowtype;
begin
  if p_id is null or p_chapter_id not between 1 and 81 or length(btrim(coalesce(p_excerpt, ''))) = 0 then
    raise exception 'invalid favorite' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 2000 then raise exception 'note is too long' using errcode = '22001'; end if;

  -- A client UUID is its idempotency key. Serialize requests for that key so a
  -- retry arriving while the first request commits observes the completed row.
  perform pg_advisory_xact_lock(0, hashtext(p_id::text));

  select * into v_existing from public.journal_favorites where id = p_id and user_id = v_user_id;
  if found then
    if v_existing.chapter_id = p_chapter_id
       and v_existing.excerpt = p_excerpt
       and v_existing.note is not distinct from p_note then
      return next v_existing;
      return;
    end if;
    raise exception 'favorite id already exists with different content' using errcode = '23505';
  end if;

  select original_text into v_original from public.chapters where id = p_chapter_id;
  if v_original is null or position(p_excerpt in v_original) = 0 then
    raise exception 'excerpt is not a continuous trusted chapter substring' using errcode = '22023';
  end if;

  insert into public.journal_favorites (id, user_id, chapter_id, excerpt, note)
  values (p_id, v_user_id, p_chapter_id, p_excerpt, p_note)
  on conflict (user_id, chapter_id, excerpt) do nothing;

  return query
    select * from public.journal_favorites
    where user_id = v_user_id and chapter_id = p_chapter_id and excerpt = p_excerpt;
end;
$$;

create or replace function public.patch_favorite(p_id uuid, p_version integer, p_note text)
returns setof public.journal_favorites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
begin
  if p_version < 1 then raise exception 'invalid version' using errcode = '22023'; end if;
  if p_note is not null and char_length(p_note) > 2000 then raise exception 'note is too long' using errcode = '22001'; end if;
  return query
    update public.journal_favorites
    set note = p_note, version = version + 1, updated_at = now()
    where id = p_id and user_id = v_user_id and version = p_version
    returning *;
end;
$$;

create or replace function public.delete_favorite(p_id uuid, p_version integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_journal_user();
begin
  if p_version < 1 then raise exception 'invalid version' using errcode = '22023'; end if;
  delete from public.journal_favorites where id = p_id and user_id = v_user_id and version = p_version;
  return found;
end;
$$;

revoke all on function public.create_favorite(uuid, smallint, text, text) from public, anon;
revoke all on function public.patch_favorite(uuid, integer, text) from public, anon;
revoke all on function public.delete_favorite(uuid, integer) from public, anon;
grant execute on function public.create_favorite(uuid, smallint, text, text) to authenticated;
grant execute on function public.patch_favorite(uuid, integer, text) to authenticated;
grant execute on function public.delete_favorite(uuid, integer) to authenticated;
