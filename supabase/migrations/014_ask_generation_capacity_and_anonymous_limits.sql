-- Durable limits and leases for the Auth / Hall / RAG worker cutover.
-- Forward-only. 013 has already been exercised on the local database and is
-- deliberately not rewritten here.

begin;

create table if not exists public.ai_generation_leases (
  lease_id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('account', 'anonymous')),
  subject text not null check (char_length(subject) between 1 and 128),
  request_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists ai_generation_leases_account_active_idx
  on public.ai_generation_leases (scope, subject)
  where scope = 'account';
create index if not exists ai_generation_leases_expiry_idx
  on public.ai_generation_leases (expires_at);
alter table public.ai_generation_leases enable row level security;
revoke all on public.ai_generation_leases from public, anon, authenticated;

alter table public.journal_ask_requests
  add column if not exists generation_lease_id uuid references public.ai_generation_leases(lease_id) on delete set null;

-- Return no more than two model calls at a time across this app.  A lease is
-- released on a fenced terminal write and expires after a worker crash.
create or replace function public.claim_next_ask_worker_job(p_worker_id uuid, p_lease_seconds integer default 75)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.journal_ask_requests%rowtype;
  v_token uuid := gen_random_uuid();
  v_lease_id uuid := gen_random_uuid();
begin
  if p_worker_id is null or p_lease_seconds not between 15 and 300 then
    raise exception 'INVALID_WORKER_CLAIM' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(0, 628055);
  delete from public.ai_generation_leases where expires_at <= now();
  if (select count(*) from public.ai_generation_leases where expires_at > now()) >= 2 then
    return null;
  end if;
  select r.* into v_request
  from public.journal_ask_requests r
  where r.available_at <= now()
    and (r.state = 'pending' or (r.state = 'processing' and r.lease_until <= now()))
    and not exists (
      select 1 from public.ai_generation_leases l
      where l.scope = 'account' and l.subject = r.user_id::text and l.expires_at > now()
    )
  order by r.available_at asc, r.created_at asc, r.request_id asc
  for update skip locked
  limit 1;
  if not found then return null; end if;

  insert into public.ai_generation_leases (lease_id, scope, subject, request_id, expires_at)
  values (v_lease_id, 'account', v_request.user_id::text, v_request.request_id, now() + make_interval(secs => p_lease_seconds));
  update public.journal_ask_requests
  set state = 'processing', worker_id = p_worker_id, claim_token = v_token,
      generation = v_request.generation + 1, generation_lease_id = v_lease_id,
      lease_until = now() + make_interval(secs => p_lease_seconds), heartbeat_at = now(), failure_code = null
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
declare
  v_lease_id uuid;
begin
  if p_lease_seconds not between 15 and 300 then raise exception 'INVALID_WORKER_HEARTBEAT' using errcode = '22023'; end if;
  update public.journal_ask_requests
  set heartbeat_at = now(), lease_until = now() + make_interval(secs => p_lease_seconds)
  where request_id = p_request_id and state = 'processing'
    and claim_token = p_claim_token and generation = p_generation
  returning generation_lease_id into v_lease_id;
  if not found or v_lease_id is null then return false; end if;
  update public.ai_generation_leases
  set expires_at = now() + make_interval(secs => p_lease_seconds)
  where lease_id = v_lease_id and expires_at > now();
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
  v_lease_id uuid;
begin
  if p_snapshot is null
    or p_snapshot->>'schemaVersion' <> '2'
    or jsonb_typeof(p_snapshot->'answerV2') <> 'object'
    or coalesce(p_snapshot->>'provider', '') not in ('agnes', 'none')
    or jsonb_typeof(coalesce(p_snapshot->'attempts', '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_ANSWER_SNAPSHOT' using errcode = '22023';
  end if;
  select generation_lease_id into v_lease_id from public.journal_ask_requests
  where user_id = p_user_id and request_id = p_request_id and state = 'processing'
    and claim_token = p_claim_token and generation = p_generation
  for update;
  if not found or v_lease_id is null then return jsonb_build_object('state', 'stale', 'stale', true); end if;
  update public.journal_ask_requests
  set state = 'generated', result_json = p_snapshot, answer_v2 = p_snapshot->'answerV2',
      provider = p_snapshot->>'provider', model = nullif(p_snapshot->>'model', ''),
      prompt_version = nullif(p_snapshot->>'promptVersion', ''), corpus_version = nullif(p_snapshot->>'corpusVersion', ''),
      attempt_summary = coalesce(p_snapshot->'attempts', '[]'::jsonb), lease_until = null,
      heartbeat_at = now(), completed_at = now(), generation_lease_id = null
  where user_id = p_user_id and request_id = p_request_id and state = 'processing'
    and claim_token = p_claim_token and generation = p_generation
  ;
  if not found then return jsonb_build_object('state', 'stale', 'stale', true); end if;
  delete from public.ai_generation_leases where lease_id = v_lease_id;
  return jsonb_build_object('state', 'generated', 'stale', false);
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
declare
  v_lease_id uuid;
begin
  if coalesce(char_length(btrim(p_failure_code)), 0) not between 1 and 96
    or (p_retry_after_seconds is not null and p_retry_after_seconds not between 0 and 86400)
    or jsonb_typeof(coalesce(p_attempts, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_WORKER_FAILURE' using errcode = '22023';
  end if;
  select generation_lease_id into v_lease_id from public.journal_ask_requests
  where user_id = p_user_id and request_id = p_request_id and state = 'processing'
    and claim_token = p_claim_token and generation = p_generation
  for update;
  if not found or v_lease_id is null then return jsonb_build_object('state', 'stale', 'stale', true); end if;
  update public.journal_ask_requests
  set state = 'failed', failure_code = p_failure_code, attempt_summary = coalesce(p_attempts, '[]'::jsonb),
      available_at = case when p_retry_after_seconds is null then available_at else now() + make_interval(secs => p_retry_after_seconds) end,
      lease_until = null, heartbeat_at = now(), completed_at = now(), generation_lease_id = null
  where user_id = p_user_id and request_id = p_request_id and state = 'processing'
    and claim_token = p_claim_token and generation = p_generation
  ;
  if not found then return jsonb_build_object('state', 'stale', 'stale', true); end if;
  delete from public.ai_generation_leases where lease_id = v_lease_id;
  return jsonb_build_object('state', 'failed', 'stale', false);
end;
$$;

create or replace function public.enqueue_ask_worker_job(
  p_user_id uuid, p_request_id uuid, p_question text,
  p_source_entry_id uuid default null, p_volume_id uuid default null
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
  if p_source_entry_id is not null and not exists (select 1 from public.journal_entries where id = p_source_entry_id and user_id = p_user_id and deleted_at is null) then
    raise exception 'SOURCE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_volume_id is not null and not exists (select 1 from public.journal_volumes where id = p_volume_id and user_id = p_user_id and archived_at is null) then
    raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(0, hashtext(p_user_id::text || ':' || p_request_id::text));
  select * into v_request from public.journal_ask_requests where user_id = p_user_id and request_id = p_request_id for update;
  if found then
    if v_request.question is distinct from v_question or v_request.source_entry_id is distinct from p_source_entry_id or v_request.volume_id is distinct from p_volume_id then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    if v_request.state = 'failed' and v_request.available_at <= now() and v_request.failure_code in ('rate_limited', 'timeout', 'network', 'server', 'invalid_json', 'invalid_citation', 'format_error', 'worker_internal_error') then
      update public.journal_ask_requests set state = 'pending', available_at = now(), failure_code = null, completed_at = null where user_id = p_user_id and request_id = p_request_id returning * into v_request;
    end if;
    return jsonb_build_object('request_id', v_request.request_id, 'state', v_request.state, 'lease_until', v_request.lease_until);
  end if;
  insert into public.ai_rate_limits(scope, subject, period_start, request_count)
  values ('account', p_user_id::text, current_date, 1)
  on conflict (scope, subject, period_start) do update set request_count = public.ai_rate_limits.request_count + 1, updated_at = now()
  where public.ai_rate_limits.request_count < 20
  returning request_count into v_daily_count;
  if v_daily_count is null then raise exception 'ACCOUNT_DAILY_LIMIT' using errcode = 'P0007'; end if;
  insert into public.ai_rate_limits(scope, subject, period_start, request_count)
  values ('global', 'ask', current_date, 1)
  on conflict (scope, subject, period_start) do update set request_count = public.ai_rate_limits.request_count + 1, updated_at = now()
  where public.ai_rate_limits.request_count < 300
  returning request_count into v_daily_count;
  if v_daily_count is null then raise exception 'GLOBAL_DAILY_LIMIT' using errcode = 'P0007'; end if;
  insert into public.journal_ask_requests (user_id, request_id, question, source_entry_id, volume_id, state, generation, available_at)
  values (p_user_id, p_request_id, v_question, p_source_entry_id, p_volume_id, 'pending', 1, now())
  returning * into v_request;
  return jsonb_build_object('request_id', v_request.request_id, 'state', v_request.state, 'lease_until', v_request.lease_until);
end;
$$;

-- Anonymous responses never persist the question.  Only an HMAC'd trusted-IP
-- bucket is recorded, and a caller must release this short model-call lease.
create or replace function public.reserve_anonymous_ask(p_ip_subject text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_lease_id uuid := gen_random_uuid();
begin
  if p_ip_subject !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'INVALID_IP_BUCKET' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(0, 628055);
  delete from public.ai_generation_leases where expires_at <= now();
  if (select count(*) from public.ai_generation_leases where expires_at > now()) >= 2 then
    raise exception 'GLOBAL_GENERATION_CAPACITY' using errcode = 'P0007';
  end if;
  if exists (select 1 from public.ai_generation_leases where scope = 'anonymous' and subject = p_ip_subject and expires_at > now()) then
    raise exception 'ANONYMOUS_GENERATION_CAPACITY' using errcode = 'P0007';
  end if;
  insert into public.ai_rate_limits(scope, subject, period_start, request_count)
  values ('ip', p_ip_subject, current_date, 1)
  on conflict (scope, subject, period_start) do update set request_count = public.ai_rate_limits.request_count + 1, updated_at = now()
  where public.ai_rate_limits.request_count < 3
  returning request_count into v_count;
  if v_count is null then raise exception 'ANONYMOUS_DAILY_LIMIT' using errcode = 'P0007'; end if;
  insert into public.ai_rate_limits(scope, subject, period_start, request_count)
  values ('global', 'ask', current_date, 1)
  on conflict (scope, subject, period_start) do update set request_count = public.ai_rate_limits.request_count + 1, updated_at = now()
  where public.ai_rate_limits.request_count < 300
  returning request_count into v_count;
  if v_count is null then raise exception 'GLOBAL_DAILY_LIMIT' using errcode = 'P0007'; end if;
  insert into public.ai_generation_leases(lease_id, scope, subject, expires_at)
  values (v_lease_id, 'anonymous', p_ip_subject, now() + interval '75 seconds');
  return jsonb_build_object('leaseId', v_lease_id, 'expiresAt', now() + interval '75 seconds');
end;
$$;

create or replace function public.release_anonymous_ask(p_lease_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.ai_generation_leases where lease_id = p_lease_id and scope = 'anonymous';
  return found;
end;
$$;

revoke all on function public.claim_next_ask_worker_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_ask_worker_job(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_ask_worker_generation(uuid, uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.fail_ask_worker_generation(uuid, uuid, uuid, integer, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.enqueue_ask_worker_job(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_anonymous_ask(text) from public, anon, authenticated;
revoke all on function public.release_anonymous_ask(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_ask_worker_job(uuid, integer) to service_role;
grant execute on function public.heartbeat_ask_worker_job(uuid, uuid, integer, integer) to service_role;
grant execute on function public.complete_ask_worker_generation(uuid, uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.fail_ask_worker_generation(uuid, uuid, uuid, integer, text, integer, jsonb) to service_role;
grant execute on function public.enqueue_ask_worker_job(uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.reserve_anonymous_ask(text) to service_role;
grant execute on function public.release_anonymous_ask(uuid) to service_role;

commit;
