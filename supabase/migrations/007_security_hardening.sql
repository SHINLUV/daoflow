-- Forward-only hardening for installations that already recorded migrations 001-006.
-- Public content remains readable, but browser roles receive no direct write privilege.

alter table public.chapters enable row level security;
alter table public.themes enable row level security;
alter table public.daily_quotes enable row level security;
alter table public.keyword_chapter_map enable row level security;

drop policy if exists chapters_public_read on public.chapters;
create policy chapters_public_read on public.chapters
  for select to anon, authenticated using (true);

drop policy if exists themes_public_read on public.themes;
create policy themes_public_read on public.themes
  for select to anon, authenticated using (true);

drop policy if exists daily_quotes_public_read on public.daily_quotes;
create policy daily_quotes_public_read on public.daily_quotes
  for select to anon, authenticated using (true);

drop policy if exists keyword_chapter_map_public_read on public.keyword_chapter_map;
create policy keyword_chapter_map_public_read on public.keyword_chapter_map
  for select to anon, authenticated using (true);

revoke all on table
  public.chapters,
  public.themes,
  public.daily_quotes,
  public.keyword_chapter_map
from public, anon, authenticated;

grant select on table
  public.chapters,
  public.themes,
  public.daily_quotes,
  public.keyword_chapter_map
to anon, authenticated;

grant select, insert, update, delete on table
  public.chapters,
  public.themes,
  public.daily_quotes,
  public.keyword_chapter_map
to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', '问道者'));
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Older installations may already have this key from a repaired 005. Add it only
-- when the exact owner/id unique constraint is absent; never drop or rewrite data.
do $$
declare
  v_user_id_attnum smallint;
  v_id_attnum smallint;
begin
  select attnum into v_user_id_attnum
  from pg_attribute
  where attrelid = 'public.journal_entries'::regclass
    and attname = 'user_id'
    and not attisdropped;

  select attnum into v_id_attnum
  from pg_attribute
  where attrelid = 'public.journal_entries'::regclass
    and attname = 'id'
    and not attisdropped;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.journal_entries'::regclass
      and contype in ('p', 'u')
      and conkey = array[v_user_id_attnum, v_id_attnum]::smallint[]
  ) then
    alter table public.journal_entries
      add constraint journal_entries_user_id_id_unique unique (user_id, id);
  end if;
end;
$$;
