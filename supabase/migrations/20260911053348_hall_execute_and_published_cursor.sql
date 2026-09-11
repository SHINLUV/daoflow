-- AH-P0 runtime gate remediation. Keep the historical foundation migration
-- immutable: this forward migration closes helper-function execution exposure
-- and makes the anonymous hall feed cursor deterministic and gap-free.

-- Internal helpers are invoked by SECURITY DEFINER entry points or triggers.
-- They are not browser RPCs and must not inherit PUBLIC EXECUTE.
revoke all on function public.require_hall_user() from public, anon, authenticated;
revoke all on function public.require_hall_reviewer() from public, anon, authenticated;
revoke all on function public.withdraw_hall_for_deleted_session() from public, anon, authenticated;
revoke all on function public.hall_normalize_quote(text) from public, anon, authenticated;
revoke all on function public.hall_source_hash(text, jsonb) from public, anon, authenticated;
revoke all on function public.hall_redact_text(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.hall_public_answer_with_redactions(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.hall_publication_dto(public.hall_publications) from public, anon, authenticated;
revoke all on function public.hall_my_publication_dto(public.hall_publications) from public, anon, authenticated;

-- `public_id` is the public, stable tie breaker. It preserves the feed's
-- no-internal-ID DTO boundary while providing the required timestamp-plus-ID
-- cursor ordering. The cursor always represents the last returned item, not
-- the probe row, so page boundaries cannot skip a publication.
create or replace function public.hall_list_publications(
  p_cursor text default null, p_chapter integer default null, p_theme text default null, p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cursor_at timestamptz := null;
  v_cursor_public_id uuid := null;
  v_publication public.hall_publications%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_next_cursor text := null;
  v_parts text[];
begin
  if p_limit not between 1 and 20 or (p_chapter is not null and p_chapter not between 1 and 81)
    or (p_theme is not null and (char_length(p_theme) not between 1 and 64 or p_theme ~ '[[:cntrl:]]')) then
    raise exception 'INVALID_HALL_LIST' using errcode = '22023';
  end if;

  if p_cursor is not null then
    if p_cursor !~ '^[0-9]{1,20}_[0-9a-fA-F-]{36}$' then
      raise exception 'INVALID_HALL_LIST' using errcode = '22023';
    end if;
    v_parts := string_to_array(p_cursor, '_');
    v_cursor_at := to_timestamp(v_parts[1]::numeric / 1000000.0);
    v_cursor_public_id := v_parts[2]::uuid;
  end if;

  for v_publication in
    select * from public.hall_publications h
    where h.status = 'published'
      and h.published_at is not null
      and (p_chapter is null or exists (
        select 1 from jsonb_array_elements(h.citations_snapshot) c where (c->>'chapter')::integer = p_chapter
      ))
      and (p_theme is null or p_theme = any(h.themes))
      and (v_cursor_at is null or (h.published_at, h.public_id) < (v_cursor_at, v_cursor_public_id))
    order by h.published_at desc, h.public_id desc
    limit p_limit + 1
  loop
    v_count := v_count + 1;
    if v_count <= p_limit then
      v_items := v_items || jsonb_build_array(public.hall_publication_dto(v_publication));
      v_next_cursor := floor(extract(epoch from v_publication.published_at) * 1000000)::bigint::text
        || '_' || v_publication.public_id::text;
    end if;
  end loop;

  if v_count <= p_limit then
    v_next_cursor := null;
  end if;
  return jsonb_build_object('items', v_items, 'next_cursor', v_next_cursor);
end;
$$;

create index if not exists hall_publications_published_cursor_idx
  on public.hall_publications (published_at desc, public_id desc)
  where status = 'published' and published_at is not null;
