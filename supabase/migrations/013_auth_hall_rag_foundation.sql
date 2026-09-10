-- Auth / Hall / RAG P0 foundation.
-- Forward-only: preserves existing private rows and never rewrites 001--012.
-- Apply only after 011_auth_user_profile_cascade.sql and
-- 012_auth_user_dependency_cascade.sql have been applied and verified.

begin;

create extension if not exists pg_trgm;

-- Keep the established public.users profile mirror as the single business
-- foreign-key target. Its auth.users cascade was verified by migration 011.
alter table public.journal_ask_requests
  drop constraint if exists journal_ask_requests_state_check;
alter table public.journal_ask_requests
  add constraint journal_ask_requests_state_check
  check (state in ('pending', 'processing', 'generated', 'saved', 'failed'));

alter table public.journal_ask_requests
  add column if not exists worker_id uuid,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists answer_v2 jsonb,
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists prompt_version text,
  add column if not exists corpus_version text,
  add column if not exists attempt_summary jsonb not null default '[]'::jsonb,
  add column if not exists failure_code text,
  add column if not exists completed_at timestamptz;

create index if not exists journal_ask_requests_worker_claim_idx
  on public.journal_ask_requests (available_at, created_at)
  where state in ('pending', 'processing');

create table if not exists public.ai_rate_limits (
  scope text not null check (scope in ('account', 'ip', 'global')),
  subject text not null check (char_length(subject) between 1 and 128),
  period_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject, period_start)
);
alter table public.ai_rate_limits enable row level security;
revoke all on public.ai_rate_limits from public, anon, authenticated;

create table if not exists public.app_user_roles (
  user_id uuid primary key references public.users(id) on delete cascade,
  role text not null check (role in ('hall_reviewer')),
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);
alter table public.app_user_roles enable row level security;
revoke all on public.app_user_roles from public, anon, authenticated;

create table if not exists public.dao_corpus_versions (
  corpus_version text primary key check (char_length(corpus_version) between 1 and 128),
  edition text not null,
  source_url text not null,
  source_revision text not null,
  source_sha256 text not null check (source_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  license text not null,
  review_status text not null check (review_status in ('pending', 'approved', 'rejected')),
  manifest_path text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((review_status = 'approved') = (reviewed_by is not null and reviewed_at is not null))
);

create table if not exists public.dao_corpus_documents (
  id uuid primary key default gen_random_uuid(),
  corpus_version text not null references public.dao_corpus_versions(corpus_version) on delete restrict,
  edition text not null,
  source_url text not null,
  source_revision text not null,
  license text not null,
  content_sha256 text not null check (content_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  review_status text not null check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((review_status = 'approved') = (reviewed_by is not null and reviewed_at is not null))
);

create table if not exists public.dao_corpus_chunks (
  chunk_id text primary key check (chunk_id ~ '^[A-Za-z0-9._:-]{1,160}$'),
  document_id uuid not null references public.dao_corpus_documents(id) on delete cascade,
  corpus_version text not null references public.dao_corpus_versions(corpus_version) on delete restrict,
  edition text not null,
  chapter smallint not null check (chapter between 1 and 81),
  paragraph integer check (paragraph is null or paragraph >= 1),
  kind text not null check (kind in ('original', 'translation', 'annotation')),
  content text not null check (char_length(btrim(content)) between 1 and 12000),
  content_sha256 text not null check (content_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  source_url text not null,
  source_revision text not null,
  license text not null,
  theme_terms text[] not null default '{}',
  review_status text not null check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((review_status = 'approved') = (reviewed_by is not null and reviewed_at is not null))
);
create index if not exists dao_corpus_chunks_approved_lexical_idx
  on public.dao_corpus_chunks using gin (content gin_trgm_ops)
  where review_status = 'approved';
create index if not exists dao_corpus_chunks_version_review_idx
  on public.dao_corpus_chunks (corpus_version, review_status, chapter, chunk_id);
alter table public.dao_corpus_versions enable row level security;
alter table public.dao_corpus_documents enable row level security;
alter table public.dao_corpus_chunks enable row level security;
revoke all on public.dao_corpus_versions, public.dao_corpus_documents, public.dao_corpus_chunks from public, anon, authenticated;

insert into public.dao_corpus_versions (
  corpus_version, edition, source_url, source_revision, source_sha256, license, review_status, manifest_path
) values (
  'dao-de-jing-wang-bi-v1',
  '道德經（王弼本）',
  'https://zh.wikisource.org/wiki/道德經_(王弼本)',
  '2354026',
  '4827E5A84B37FDEAA99706B7505B3719B5EB40E2DA8E7B8A0A499944051AF611',
  'CC-BY-SA-4.0_or_later_pending_license_page_capture',
  'pending',
  'docs/redesign-v2/corpus/dao-de-jing-wang-bi-v1.manifest.json'
) on conflict (corpus_version) do nothing;

create table if not exists public.hall_publications (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  source_session_id uuid,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  idempotency_key uuid not null,
  public_question text not null check (char_length(btrim(public_question)) between 1 and 500),
  answer_snapshot jsonb not null,
  public_answer_snapshot jsonb not null,
  citations_snapshot jsonb not null,
  themes text[] not null default '{}',
  provider text not null check (provider = 'agnes'),
  degraded boolean not null default false check (degraded = false),
  model text,
  prompt_version text not null,
  corpus_version text not null,
  status text not null check (status in ('pending', 'published', 'withdrawn', 'rejected')),
  version integer not null default 1 check (version >= 1),
  redacted boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  withdrawn_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  unique (owner_id, source_session_id),
  unique (owner_id, idempotency_key),
  foreign key (owner_id, source_session_id)
    references public.ask_sessions(user_id, id)
    on delete set null (source_session_id)
);
create index if not exists hall_publications_public_feed_idx
  on public.hall_publications (created_at desc, public_id desc)
  where status = 'published';
create index if not exists hall_publications_owner_idx
  on public.hall_publications (owner_id, created_at desc);
alter table public.hall_publications enable row level security;
revoke all on public.hall_publications from public, anon, authenticated;

create table if not exists public.hall_reports (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.hall_publications(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason text not null check (reason in ('privacy', 'abuse', 'unsafe', 'copyright', 'other')),
  note text not null check (char_length(btrim(note)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (publication_id, reporter_id, reason)
);
alter table public.hall_reports enable row level security;
revoke all on public.hall_reports from public, anon, authenticated;

create or replace function public.withdraw_hall_for_deleted_session()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.hall_publications
  set status = 'withdrawn', withdrawn_at = coalesce(withdrawn_at, now()), version = version + 1
  where owner_id = old.user_id
    and source_session_id = old.id
    and status in ('pending', 'published');
  return old;
end;
$$;

drop trigger if exists ask_sessions_withdraw_hall_before_delete on public.ask_sessions;
create trigger ask_sessions_withdraw_hall_before_delete
before delete on public.ask_sessions
for each row execute procedure public.withdraw_hall_for_deleted_session();

-- Worker RPCs are service-only. Browser requests enqueue through the BFF route;
-- no browser role receives a write grant to requests, rate limits, or corpus.
create or replace function public.enqueue_ask_worker_job(
  p_user_id uuid,
  p_request_id uuid,
  p_question text,
  p_source_entry_id uuid default null,
  p_volume_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.journal_ask_requests%rowtype;
  v_question text := btrim(coalesce(p_question, ''));
  v_daily_count integer;
begin
  if p_user_id is null or p_request_id is null or char_length(v_question) not between 1 and 500 then
    raise exception 'INVALID_ASK_REQUEST' using errcode = '22023';
  end if;
  insert into public.users(id) values (p_user_id) on conflict (id) do nothing;
  if p_source_entry_id is not null and not exists (
    select 1 from public.journal_entries where id = p_source_entry_id and user_id = p_user_id and deleted_at is null
  ) then raise exception 'SOURCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_volume_id is not null and not exists (
    select 1 from public.journal_volumes where id = p_volume_id and user_id = p_user_id and archived_at is null
  ) then raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(0, hashtext(p_user_id::text || ':' || p_request_id::text));
  select * into v_request from public.journal_ask_requests
  where user_id = p_user_id and request_id = p_request_id for update;
  if found then
    if v_request.question is distinct from v_question
      or v_request.source_entry_id is distinct from p_source_entry_id
      or v_request.volume_id is distinct from p_volume_id then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    return jsonb_build_object('request_id', v_request.request_id, 'state', v_request.state, 'lease_until', v_request.lease_until);
  end if;

  insert into public.ai_rate_limits(scope, subject, period_start, request_count)
  values ('account', p_user_id::text, current_date, 1)
  on conflict (scope, subject, period_start) do update
    set request_count = public.ai_rate_limits.request_count + 1, updated_at = now()
    where public.ai_rate_limits.request_count < 20
  returning request_count into v_daily_count;
  if v_daily_count is null then raise exception 'ACCOUNT_DAILY_LIMIT' using errcode = 'P0007'; end if;

  insert into public.journal_ask_requests (
    user_id, request_id, question, source_entry_id, volume_id, state, generation, available_at
  ) values (
    p_user_id, p_request_id, v_question, p_source_entry_id, p_volume_id, 'pending', 1, now()
  ) returning * into v_request;
  return jsonb_build_object('request_id', v_request.request_id, 'state', v_request.state, 'lease_until', v_request.lease_until);
end;
$$;

create or replace function public.claim_next_ask_worker_job(p_worker_id uuid, p_lease_seconds integer default 75)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.journal_ask_requests%rowtype;
  v_token uuid := gen_random_uuid();
begin
  if p_worker_id is null or p_lease_seconds not between 15 and 300 then
    raise exception 'INVALID_WORKER_CLAIM' using errcode = '22023';
  end if;
  select * into v_request
  from public.journal_ask_requests
  where available_at <= now()
    and (state = 'pending' or (state = 'processing' and lease_until <= now()))
  order by available_at asc, created_at asc, request_id asc
  for update skip locked
  limit 1;
  if not found then return null; end if;

  update public.journal_ask_requests
  set state = 'processing', worker_id = p_worker_id, claim_token = v_token,
      generation = v_request.generation + 1,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(), failure_code = null
  where user_id = v_request.user_id and request_id = v_request.request_id
  returning * into v_request;
  return jsonb_build_object(
    'requestId', v_request.request_id, 'userId', v_request.user_id, 'question', v_request.question,
    'claimToken', v_request.claim_token, 'generation', v_request.generation,
    'sourceEntryId', v_request.source_entry_id, 'volumeId', v_request.volume_id
  );
end;
$$;

create or replace function public.heartbeat_ask_worker_job(
  p_request_id uuid, p_claim_token uuid, p_generation integer, p_lease_seconds integer default 75
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_lease_seconds not between 15 and 300 then raise exception 'INVALID_WORKER_HEARTBEAT' using errcode = '22023'; end if;
  update public.journal_ask_requests
  set heartbeat_at = now(), lease_until = now() + make_interval(secs => p_lease_seconds)
  where request_id = p_request_id and state = 'processing'
    and claim_token = p_claim_token and generation = p_generation;
  return found;
end;
$$;

create or replace function public.complete_ask_worker_generation(
  p_user_id uuid, p_request_id uuid, p_claim_token uuid, p_generation integer, p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.journal_ask_requests%rowtype;
begin
  if p_snapshot is null
    or p_snapshot->>'schemaVersion' <> '2'
    or jsonb_typeof(p_snapshot->'answerV2') <> 'object'
    or coalesce(p_snapshot->>'provider', '') not in ('agnes', 'none')
    or jsonb_typeof(coalesce(p_snapshot->'attempts', '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_ANSWER_SNAPSHOT' using errcode = '22023';
  end if;
  update public.journal_ask_requests
  set state = 'generated', result_json = p_snapshot, answer_v2 = p_snapshot->'answerV2',
      provider = p_snapshot->>'provider', model = nullif(p_snapshot->>'model', ''),
      prompt_version = nullif(p_snapshot->>'promptVersion', ''), corpus_version = nullif(p_snapshot->>'corpusVersion', ''),
      attempt_summary = coalesce(p_snapshot->'attempts', '[]'::jsonb),
      lease_until = null, heartbeat_at = now(), completed_at = now()
  where user_id = p_user_id and request_id = p_request_id and state = 'processing'
    and claim_token = p_claim_token and generation = p_generation
  returning * into v_request;
  if found then return jsonb_build_object('state', 'generated', 'stale', false); end if;
  return jsonb_build_object('state', 'stale', 'stale', true);
end;
$$;

create or replace function public.fail_ask_worker_generation(
  p_user_id uuid, p_request_id uuid, p_claim_token uuid, p_generation integer,
  p_failure_code text, p_retry_after_seconds integer, p_attempts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(char_length(btrim(p_failure_code)), 0) not between 1 and 96
    or (p_retry_after_seconds is not null and p_retry_after_seconds not between 0 and 86400)
    or jsonb_typeof(coalesce(p_attempts, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_WORKER_FAILURE' using errcode = '22023';
  end if;
  update public.journal_ask_requests
  set state = 'failed', failure_code = p_failure_code, attempt_summary = coalesce(p_attempts, '[]'::jsonb),
      available_at = case when p_retry_after_seconds is null then available_at else now() + make_interval(secs => p_retry_after_seconds) end,
      lease_until = null, heartbeat_at = now(), completed_at = now()
  where user_id = p_user_id and request_id = p_request_id and state = 'processing'
    and claim_token = p_claim_token and generation = p_generation;
  if found then return jsonb_build_object('state', 'failed', 'stale', false); end if;
  return jsonb_build_object('state', 'stale', 'stale', true);
end;
$$;

-- Existing ask_sessions rows are v1. New fields are nullable for those rows.
alter table public.ask_sessions
  add column if not exists answer_v2 jsonb,
  add column if not exists model text,
  add column if not exists prompt_version text,
  add column if not exists corpus_version text;

create or replace function public.save_ask_worker_generation(
  p_user_id uuid, p_request_id uuid, p_claim_token uuid, p_generation integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.journal_ask_requests%rowtype;
  v_session_id uuid;
  v_chapter smallint;
  v_response text;
begin
  select * into v_request from public.journal_ask_requests
  where user_id = p_user_id and request_id = p_request_id
    and state = 'generated' and claim_token = p_claim_token and generation = p_generation
  for update;
  if not found then return jsonb_build_object('state', 'stale', 'stale', true); end if;
  v_chapter := nullif(v_request.answer_v2 #>> '{citations,0,chapter}', '')::smallint;
  v_response := coalesce(nullif(v_request.answer_v2->>'interpretation', ''), nullif(v_request.answer_v2->>'summary', ''), '当前未生成可保存的解读。');
  insert into public.ask_sessions (
    user_id, request_id, source_entry_id, volume_id, question, matched_chapter_id,
    ai_response, follow_up_question, ai_provider, degraded, fallback_reason,
    answer_v2, model, prompt_version, corpus_version
  ) values (
    p_user_id, p_request_id, v_request.source_entry_id, v_request.volume_id, v_request.question, v_chapter,
    v_response, nullif(v_request.answer_v2->>'reflection', ''), v_request.provider,
    coalesce((v_request.result_json->>'degraded')::boolean, false), v_request.failure_code,
    v_request.answer_v2, v_request.model, v_request.prompt_version, v_request.corpus_version
  ) on conflict (user_id, request_id) do update
    set answer_v2 = excluded.answer_v2, ai_response = excluded.ai_response,
        follow_up_question = excluded.follow_up_question, ai_provider = excluded.ai_provider,
        degraded = excluded.degraded, fallback_reason = excluded.fallback_reason,
        model = excluded.model, prompt_version = excluded.prompt_version, corpus_version = excluded.corpus_version
  returning id into v_session_id;
  update public.journal_ask_requests
  set state = 'saved', session_id = v_session_id, completed_at = now()
  where user_id = p_user_id and request_id = p_request_id
    and state = 'generated' and claim_token = p_claim_token and generation = p_generation;
  if not found then return jsonb_build_object('state', 'stale', 'stale', true); end if;
  return jsonb_build_object('state', 'saved', 'stale', false, 'sessionId', v_session_id);
end;
$$;

create or replace function public.retry_save_generated_ask_result(p_user_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.journal_ask_requests%rowtype;
  v_session_id uuid;
  v_chapter smallint;
  v_response text;
begin
  select * into v_request from public.journal_ask_requests
  where user_id = p_user_id and request_id = p_request_id for update;
  if not found then raise exception 'ASK_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_request.state = 'saved' then return jsonb_build_object('state', 'saved', 'sessionId', v_request.session_id); end if;
  if v_request.state <> 'generated' or v_request.answer_v2 is null then
    raise exception 'ASK_RESULT_NOT_READY' using errcode = 'P0001';
  end if;
  v_chapter := nullif(v_request.answer_v2 #>> '{citations,0,chapter}', '')::smallint;
  v_response := coalesce(nullif(v_request.answer_v2->>'interpretation', ''), nullif(v_request.answer_v2->>'summary', ''), '当前未生成可保存的解读。');
  insert into public.ask_sessions (
    user_id, request_id, source_entry_id, volume_id, question, matched_chapter_id,
    ai_response, follow_up_question, ai_provider, degraded, fallback_reason,
    answer_v2, model, prompt_version, corpus_version
  ) values (
    p_user_id, p_request_id, v_request.source_entry_id, v_request.volume_id, v_request.question, v_chapter,
    v_response, nullif(v_request.answer_v2->>'reflection', ''), v_request.provider,
    coalesce((v_request.result_json->>'degraded')::boolean, false), v_request.failure_code,
    v_request.answer_v2, v_request.model, v_request.prompt_version, v_request.corpus_version
  ) on conflict (user_id, request_id) do update
    set answer_v2 = excluded.answer_v2, ai_response = excluded.ai_response,
        follow_up_question = excluded.follow_up_question, ai_provider = excluded.ai_provider,
        degraded = excluded.degraded, fallback_reason = excluded.fallback_reason,
        model = excluded.model, prompt_version = excluded.prompt_version, corpus_version = excluded.corpus_version
  returning id into v_session_id;
  update public.journal_ask_requests set state = 'saved', session_id = v_session_id, completed_at = now()
  where user_id = p_user_id and request_id = p_request_id and state = 'generated';
  return jsonb_build_object('state', 'saved', 'sessionId', v_session_id);
end;
$$;

create table if not exists public.auth_rate_limit_events (
  action text not null check (action in ('otp_request', 'password_sign_up', 'password_recovery', 'password_failure')),
  key_type text not null check (key_type in ('email', 'ip')),
  key_hash text not null check (key_hash ~ '^[A-Za-z0-9_-]{20,128}$'),
  occurred_at timestamptz not null default now(),
  primary key (action, key_type, key_hash, occurred_at)
);
create index if not exists auth_rate_limit_events_window_idx
  on public.auth_rate_limit_events(action, key_type, key_hash, occurred_at desc);
alter table public.auth_rate_limit_events enable row level security;
revoke all on public.auth_rate_limit_events from public, anon, authenticated;

create or replace function public.check_auth_rate_limit(
  p_action text, p_email_key text, p_ip_key text, p_limit integer, p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_oldest timestamptz;
begin
  if p_action not in ('otp_request', 'password_sign_up', 'password_recovery', 'password_failure')
    or p_limit not between 1 and 100 or p_window_seconds not between 1 and 86400
    or p_email_key !~ '^[A-Za-z0-9_-]{20,128}$' or p_ip_key !~ '^[A-Za-z0-9_-]{20,128}$' then
    raise exception 'INVALID_RATE_LIMIT_INPUT' using errcode = '22023';
  end if;
  select count(*), min(occurred_at) into v_count, v_oldest
  from public.auth_rate_limit_events
  where action = p_action and occurred_at > now() - make_interval(secs => p_window_seconds)
    and ((key_type = 'email' and key_hash = p_email_key) or (key_type = 'ip' and key_hash = p_ip_key));
  if v_count >= p_limit then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer));
  end if;
  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

create or replace function public.consume_auth_rate_limit(
  p_action text, p_email_key text, p_ip_key text, p_limit integer, p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_check jsonb;
begin
  perform pg_advisory_xact_lock(1, hashtext(p_action || ':' || p_email_key));
  perform pg_advisory_xact_lock(1, hashtext(p_action || ':' || p_ip_key));
  v_check := public.check_auth_rate_limit(p_action, p_email_key, p_ip_key, p_limit, p_window_seconds);
  if coalesce((v_check->>'allowed')::boolean, false) is not true then return v_check; end if;
  insert into public.auth_rate_limit_events(action, key_type, key_hash) values
    (p_action, 'email', p_email_key), (p_action, 'ip', p_ip_key);
  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

create or replace function public.has_mfa_recovery_factor()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select false
$$;

create or replace function public.require_hall_user()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  insert into public.users(id) values (v_user_id) on conflict (id) do nothing;
  return v_user_id;
end;
$$;

create or replace function public.require_hall_reviewer()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := public.require_hall_user();
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2'
     or not exists (select 1 from public.app_user_roles where user_id = v_user_id and role = 'hall_reviewer') then
    raise exception 'REVIEWER_REQUIRED' using errcode = 'P0004';
  end if;
  return v_user_id;
end;
$$;

create or replace function public.hall_normalize_quote(p_text text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(normalize(coalesce(p_text, ''), NFC), '[[:space:]，。；、：！？“”‘’「」『』（）()《》〈〉…—-]', '', 'g')
$$;

create or replace function public.hall_source_hash(p_question text, p_answer jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(extensions.digest(coalesce(p_question, '') || chr(10) || coalesce(p_answer::text, ''), 'sha256'), 'hex')
$$;

create or replace function public.hall_redact_text(p_text text, p_field text, p_redactions jsonb)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_result text := p_text;
  v_item jsonb;
  v_start integer;
  v_end integer;
  v_previous_start integer := char_length(p_text) + 1;
begin
  if jsonb_typeof(coalesce(p_redactions, '[]'::jsonb)) <> 'array' then
    raise exception 'REGENERATE_REQUIRED' using errcode = 'P0006';
  end if;
  for v_item in
    select value from jsonb_array_elements(p_redactions)
    where value->>'field' = p_field
    order by (value->>'start')::integer desc, (value->>'end')::integer desc
  loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'start', '') !~ '^[0-9]{1,5}$'
      or coalesce(v_item->>'end', '') !~ '^[0-9]{1,5}$' then
      raise exception 'REGENERATE_REQUIRED' using errcode = 'P0006';
    end if;
    v_start := (v_item->>'start')::integer;
    v_end := (v_item->>'end')::integer;
    if v_start < 0 or v_end <= v_start or v_end > char_length(p_text) or v_end > v_previous_start then
      raise exception 'REGENERATE_REQUIRED' using errcode = 'P0006';
    end if;
    v_result := overlay(v_result placing '[已隐去]' from v_start + 1 for v_end - v_start);
    v_previous_start := v_start;
  end loop;
  return v_result;
end;
$$;

create or replace function public.hall_public_answer_with_redactions(p_answer jsonb, p_redactions jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_answer jsonb := p_answer;
  v_field text;
  v_index integer;
  v_item jsonb;
begin
  if jsonb_typeof(v_answer) <> 'object' or jsonb_typeof(coalesce(p_redactions, '[]'::jsonb)) <> 'array' then
    raise exception 'REGENERATE_REQUIRED' using errcode = 'P0006';
  end if;
  for v_item in select value from jsonb_array_elements(p_redactions) loop
    if jsonb_typeof(v_item) <> 'object' or coalesce(v_item->>'field', '') !~ '^(summary|interpretation|application|boundary|reflection|actions\.(?:[0-9]|1[0-9]))$' then
      raise exception 'REGENERATE_REQUIRED' using errcode = 'P0006';
    end if;
  end loop;
  foreach v_field in array array['summary', 'interpretation', 'application', 'boundary', 'reflection'] loop
    if jsonb_typeof(v_answer->v_field) <> 'string' then raise exception 'PUBLICATION_INELIGIBLE' using errcode = 'P0005'; end if;
    v_answer := jsonb_set(v_answer, array[v_field], to_jsonb(public.hall_redact_text(v_answer->>v_field, v_field, p_redactions)), true);
  end loop;
  if jsonb_typeof(v_answer->'actions') <> 'array' then raise exception 'PUBLICATION_INELIGIBLE' using errcode = 'P0005'; end if;
  for v_index in 0..jsonb_array_length(v_answer->'actions') - 1 loop
    if jsonb_typeof(v_answer->'actions'->v_index) <> 'string' then raise exception 'PUBLICATION_INELIGIBLE' using errcode = 'P0005'; end if;
    v_answer := jsonb_set(v_answer, array['actions', v_index::text], to_jsonb(public.hall_redact_text(v_answer->'actions'->>v_index, 'actions.' || v_index::text, p_redactions)), true);
  end loop;
  return v_answer;
end;
$$;

create or replace function public.hall_publication_dto(p_publication public.hall_publications)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'public_id', p_publication.public_id,
    'public_question', p_publication.public_question,
    'public_answer_snapshot', p_publication.public_answer_snapshot,
    'provider', p_publication.provider,
    'degraded', p_publication.degraded,
    'prompt_version', p_publication.prompt_version,
    'corpus_version', p_publication.corpus_version,
    'status', p_publication.status,
    'published_at', p_publication.published_at
  )
$$;

create or replace function public.hall_my_publication_dto(p_publication public.hall_publications)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_publication.id,
    'public_id', p_publication.public_id,
    'public_question', p_publication.public_question,
    'status', p_publication.status,
    'version', p_publication.version,
    'redacted', p_publication.redacted,
    'created_at', p_publication.created_at,
    'published_at', p_publication.published_at,
    'withdrawn_at', p_publication.withdrawn_at
  )
$$;

create or replace function public.hall_get_publication_preview(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_hall_user();
  v_session public.ask_sessions%rowtype;
  v_citation jsonb;
begin
  select * into v_session from public.ask_sessions where id = p_session_id and user_id = v_user_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_session.ai_provider <> 'agnes' or coalesce(v_session.degraded, false) or v_session.answer_v2 is null
    or v_session.answer_v2->>'status' <> 'answer'
    or jsonb_typeof(v_session.answer_v2->'citations') <> 'array'
    or jsonb_array_length(v_session.answer_v2->'citations') not between 1 and 3 then
    raise exception 'PUBLICATION_INELIGIBLE' using errcode = 'P0005';
  end if;
  for v_citation in select value from jsonb_array_elements(v_session.answer_v2->'citations') loop
    if not exists (
      select 1 from public.dao_corpus_chunks c
      where c.chunk_id = v_citation->>'chunk_id'
        and c.corpus_version = v_session.corpus_version
        and c.review_status = 'approved'
        and (v_citation->>'chapter')::integer = c.chapter
        and public.hall_normalize_quote(c.content) like '%' || public.hall_normalize_quote(v_citation->>'quote') || '%'
    ) then raise exception 'PUBLICATION_INELIGIBLE' using errcode = 'P0005'; end if;
  end loop;
  return jsonb_build_object(
    'session_id', v_session.id,
    'source_hash', public.hall_source_hash(v_session.question, v_session.answer_v2),
    'question', v_session.question,
    'answer', v_session.answer_v2,
    'prompt_version', v_session.prompt_version,
    'corpus_version', v_session.corpus_version,
    'model', v_session.model
  );
end;
$$;

create or replace function public.hall_create_publication(
  p_session_id uuid,
  p_source_hash text,
  p_question_redactions jsonb,
  p_answer_redactions jsonb,
  p_consent boolean,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.require_hall_user();
  v_preview jsonb;
  v_existing public.hall_publications%rowtype;
  v_publication public.hall_publications%rowtype;
  v_question text;
  v_answer jsonb;
  v_redacted boolean;
  v_item jsonb;
begin
  if p_session_id is null or p_idempotency_key is null or coalesce(p_consent, false) is not true
    or coalesce(p_source_hash, '') !~ '^[a-f0-9]{64}$'
    or jsonb_array_length(coalesce(p_question_redactions, '[]'::jsonb)) > 24
    or jsonb_array_length(coalesce(p_answer_redactions, '[]'::jsonb)) > 24 then
    raise exception 'REGENERATE_REQUIRED' using errcode = 'P0006';
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_question_redactions, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) <> 'object' or v_item->>'field' <> 'question' then
      raise exception 'REGENERATE_REQUIRED' using errcode = 'P0006';
    end if;
  end loop;

  select * into v_existing from public.hall_publications
  where owner_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.source_session_id = p_session_id and v_existing.source_hash = p_source_hash then
      return public.hall_my_publication_dto(v_existing);
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.hall_publications where owner_id = v_user_id and source_session_id = p_session_id) then
    raise exception 'PUBLICATION_EXISTS' using errcode = '23505';
  end if;

  v_preview := public.hall_get_publication_preview(p_session_id);
  if lower(p_source_hash) <> v_preview->>'source_hash' then raise exception 'REGENERATE_REQUIRED' using errcode = 'P0006'; end if;
  v_question := public.hall_redact_text(v_preview->>'question', 'question', coalesce(p_question_redactions, '[]'::jsonb));
  v_answer := public.hall_public_answer_with_redactions(v_preview->'answer', coalesce(p_answer_redactions, '[]'::jsonb));
  v_redacted := jsonb_array_length(coalesce(p_question_redactions, '[]'::jsonb)) + jsonb_array_length(coalesce(p_answer_redactions, '[]'::jsonb)) > 0;

  insert into public.hall_publications (
    owner_id, source_session_id, source_hash, idempotency_key, public_question,
    answer_snapshot, public_answer_snapshot, citations_snapshot, provider, degraded,
    model, prompt_version, corpus_version, status, redacted
  ) values (
    v_user_id, p_session_id, lower(p_source_hash), p_idempotency_key, v_question,
    v_preview->'answer', v_answer, v_answer->'citations', 'agnes', false,
    nullif(v_preview->>'model', ''), nullif(v_preview->>'prompt_version', ''), coalesce(nullif(v_preview->>'corpus_version', ''), 'unversioned'), 'pending', v_redacted
  ) returning * into v_publication;
  return public.hall_my_publication_dto(v_publication);
end;
$$;

create or replace function public.hall_get_publication(p_public_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_publication public.hall_publications%rowtype;
begin
  select * into v_publication from public.hall_publications
  where public_id = p_public_id and status = 'published';
  if not found then return null; end if;
  return public.hall_publication_dto(v_publication);
end;
$$;

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
  v_cursor_id uuid := null;
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
    if p_cursor !~ '^[0-9]{1,20}_[0-9a-fA-F-]{36}$' then raise exception 'INVALID_HALL_LIST' using errcode = '22023'; end if;
    v_parts := string_to_array(p_cursor, '_');
    v_cursor_at := to_timestamp(v_parts[1]::numeric / 1000000.0);
    v_cursor_id := v_parts[2]::uuid;
  end if;
  for v_publication in
    select * from public.hall_publications h
    where h.status = 'published'
      and (p_chapter is null or exists (select 1 from jsonb_array_elements(h.citations_snapshot) c where (c->>'chapter')::integer = p_chapter))
      and (p_theme is null or p_theme = any(h.themes))
      and (v_cursor_at is null or (h.created_at, h.public_id) < (v_cursor_at, v_cursor_id))
    order by h.created_at desc, h.public_id desc
    limit p_limit + 1
  loop
    v_count := v_count + 1;
    if v_count <= p_limit then
      v_items := v_items || jsonb_build_array(public.hall_publication_dto(v_publication));
    else
      v_next_cursor := floor(extract(epoch from v_publication.created_at) * 1000000)::bigint::text || '_' || v_publication.public_id::text;
    end if;
  end loop;
  return jsonb_build_object('items', v_items, 'next_cursor', v_next_cursor);
end;
$$;

create or replace function public.hall_list_my_publications()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := public.require_hall_user();
begin
  return coalesce((
    select jsonb_agg(public.hall_my_publication_dto(h) order by h.created_at desc, h.id desc)
    from public.hall_publications h where h.owner_id = v_user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.hall_withdraw_publication(p_public_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := public.require_hall_user(); v_publication public.hall_publications%rowtype;
begin
  update public.hall_publications
  set status = 'withdrawn', withdrawn_at = now(), version = version + 1
  where owner_id = v_user_id and public_id = p_public_id and version = p_expected_version
    and status in ('pending', 'published', 'rejected')
  returning * into v_publication;
  if found then return public.hall_my_publication_dto(v_publication); end if;
  if exists (select 1 from public.hall_publications where owner_id = v_user_id and public_id = p_public_id) then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0003';
  end if;
  raise exception 'NOT_FOUND' using errcode = 'P0002';
end;
$$;

create or replace function public.hall_submit_report(p_public_id uuid, p_reason text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := public.require_hall_user(); v_publication_id uuid;
begin
  if p_reason not in ('privacy', 'abuse', 'unsafe', 'copyright', 'other') or char_length(btrim(coalesce(p_note, ''))) not between 1 and 500 then
    raise exception 'INVALID_REPORT' using errcode = '22023';
  end if;
  select id into v_publication_id from public.hall_publications where public_id = p_public_id and status = 'published';
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.hall_reports(publication_id, reporter_id, reason, note)
  values (v_publication_id, v_user_id, p_reason, btrim(p_note)) on conflict (publication_id, reporter_id, reason) do nothing;
  return jsonb_build_object('accepted', true);
end;
$$;

create or replace function public.hall_review_publication(p_public_id uuid, p_expected_version integer, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_reviewer_id uuid := public.require_hall_reviewer(); v_publication public.hall_publications%rowtype;
begin
  if p_decision not in ('approve', 'reject') then raise exception 'INVALID_REVIEW' using errcode = '22023'; end if;
  update public.hall_publications
  set status = case when p_decision = 'approve' then 'published' else 'rejected' end,
      version = version + 1, reviewed_by = v_reviewer_id, reviewed_at = now(),
      published_at = case when p_decision = 'approve' then now() else null end
  where public_id = p_public_id and status = 'pending' and version = p_expected_version
  returning * into v_publication;
  if found then return public.hall_my_publication_dto(v_publication); end if;
  if exists (select 1 from public.hall_publications where public_id = p_public_id) then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0003';
  end if;
  raise exception 'NOT_FOUND' using errcode = 'P0002';
end;
$$;

revoke all on function public.enqueue_ask_worker_job(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_next_ask_worker_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_ask_worker_job(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_ask_worker_generation(uuid, uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.fail_ask_worker_generation(uuid, uuid, uuid, integer, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.save_ask_worker_generation(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.retry_save_generated_ask_result(uuid, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_ask_worker_job(uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.claim_next_ask_worker_job(uuid, integer) to service_role;
grant execute on function public.heartbeat_ask_worker_job(uuid, uuid, integer, integer) to service_role;
grant execute on function public.complete_ask_worker_generation(uuid, uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.fail_ask_worker_generation(uuid, uuid, uuid, integer, text, integer, jsonb) to service_role;
grant execute on function public.save_ask_worker_generation(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.retry_save_generated_ask_result(uuid, uuid) to service_role;
revoke all on function public.consume_auth_rate_limit(text, text, text, integer, integer) from public, anon;
revoke all on function public.check_auth_rate_limit(text, text, text, integer, integer) from public, anon;
grant execute on function public.consume_auth_rate_limit(text, text, text, integer, integer) to authenticated;
grant execute on function public.check_auth_rate_limit(text, text, text, integer, integer) to authenticated;
revoke all on function public.has_mfa_recovery_factor() from public, anon;
grant execute on function public.has_mfa_recovery_factor() to authenticated;
revoke all on function public.hall_list_publications(text, integer, text, integer) from public;
revoke all on function public.hall_get_publication(uuid) from public;
revoke all on function public.hall_get_publication_preview(uuid) from public, anon;
revoke all on function public.hall_create_publication(uuid, text, jsonb, jsonb, boolean, uuid) from public, anon;
revoke all on function public.hall_list_my_publications() from public, anon;
revoke all on function public.hall_withdraw_publication(uuid, integer) from public, anon;
revoke all on function public.hall_submit_report(uuid, text, text) from public, anon;
revoke all on function public.hall_review_publication(uuid, integer, text) from public, anon;
grant execute on function public.hall_list_publications(text, integer, text, integer) to anon, authenticated;
grant execute on function public.hall_get_publication(uuid) to anon, authenticated;
grant execute on function public.hall_get_publication_preview(uuid) to authenticated;
grant execute on function public.hall_create_publication(uuid, text, jsonb, jsonb, boolean, uuid) to authenticated;
grant execute on function public.hall_list_my_publications() to authenticated;
grant execute on function public.hall_withdraw_publication(uuid, integer) to authenticated;
grant execute on function public.hall_submit_report(uuid, text, text) to authenticated;
grant execute on function public.hall_review_publication(uuid, integer, text) to authenticated;

commit;
