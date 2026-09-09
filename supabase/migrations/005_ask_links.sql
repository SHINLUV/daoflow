-- DaoFlow V2 T07. Apply only after 003_journal.sql and 004_favorites.sql in an isolated local project.

alter table public.ask_sessions add column if not exists request_id uuid;
alter table public.ask_sessions add column if not exists source_entry_id uuid;
alter table public.ask_sessions add column if not exists volume_id uuid;
alter table public.ask_sessions drop constraint if exists ask_sessions_user_request_unique;
alter table public.ask_sessions add constraint ask_sessions_user_request_unique unique (user_id, request_id);
alter table public.ask_sessions drop constraint if exists ask_sessions_user_id_id_unique;
alter table public.ask_sessions add constraint ask_sessions_user_id_id_unique unique (user_id, id);
alter table public.ask_sessions drop constraint if exists ask_sessions_source_entry_owner_fkey;
alter table public.ask_sessions add constraint ask_sessions_source_entry_owner_fkey
  foreign key (user_id, source_entry_id) references public.journal_entries(user_id, id) on delete set null (source_entry_id);
alter table public.ask_sessions drop constraint if exists ask_sessions_volume_owner_fkey;
alter table public.ask_sessions add constraint ask_sessions_volume_owner_fkey
  foreign key (user_id, volume_id) references public.journal_volumes(user_id, id);

create table if not exists public.journal_ask_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  question text not null check (char_length(btrim(question)) between 1 and 500),
  source_entry_id uuid,
  volume_id uuid,
  state text not null check (state in ('processing', 'generated', 'saved', 'failed')),
  result_json jsonb,
  session_id uuid,
  created_at timestamptz not null default now(),
  lease_until timestamptz,
  claim_token uuid,
  generation integer not null default 1 check (generation >= 1),
  primary key (user_id, request_id),
  foreign key (user_id, source_entry_id) references public.journal_entries(user_id, id) on delete set null (source_entry_id),
  foreign key (user_id, volume_id) references public.journal_volumes(user_id, id),
  foreign key (user_id, session_id) references public.ask_sessions(user_id, id)
);

alter table public.journal_ask_requests enable row level security;
drop policy if exists journal_ask_requests_select_own on public.journal_ask_requests;
create policy journal_ask_requests_select_own on public.journal_ask_requests for select to authenticated using (auth.uid() = user_id);
revoke all on table public.journal_ask_requests from public, anon, authenticated;
grant select on table public.journal_ask_requests to authenticated;

-- The historical policy allowed direct writes. Keep old rows but make both old and new
-- request state readable only by its owner; service-only functions below perform writes.
drop policy if exists "用户只能读写自己的问道记录" on public.ask_sessions;
drop policy if exists ask_sessions_select_own on public.ask_sessions;
create policy ask_sessions_select_own on public.ask_sessions for select to authenticated using (auth.uid() = user_id);
revoke all on table public.ask_sessions from public, anon, authenticated;
grant select on table public.ask_sessions to authenticated;

create or replace function public.claim_ask_request(
  p_user_id uuid, p_request_id uuid, p_question text, p_source_entry_id uuid default null, p_volume_id uuid default null
)
returns table (request_id uuid, state text, result_json jsonb, session_id uuid, claim_token uuid, generation integer, lease_until timestamptz, claimed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request public.journal_ask_requests%rowtype;
  v_question text := btrim(coalesce(p_question, ''));
  v_token uuid := gen_random_uuid();
begin
  if p_user_id is null or p_request_id is null or char_length(v_question) not between 1 and 500 then raise exception 'INVALID_ASK_REQUEST' using errcode = '22023'; end if;
  if p_source_entry_id is not null and not exists (select 1 from public.journal_entries where id=p_source_entry_id and user_id=p_user_id and deleted_at is null) then raise exception 'SOURCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_volume_id is not null and not exists (select 1 from public.journal_volumes where id=p_volume_id and user_id=p_user_id and archived_at is null) then raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(0, hashtext(p_user_id::text || ':' || p_request_id::text));
  select * into v_request from public.journal_ask_requests where user_id=p_user_id and request_id=p_request_id for update;
  if found then
    if v_request.question is distinct from v_question or v_request.source_entry_id is distinct from p_source_entry_id or v_request.volume_id is distinct from p_volume_id then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001'; end if;
    if v_request.state='processing' and v_request.lease_until <= now() then
      update public.journal_ask_requests set claim_token=v_token, generation=generation+1, lease_until=now()+interval '60 seconds'
      where user_id=p_user_id and request_id=p_request_id returning * into v_request;
      return query select v_request.request_id,v_request.state,v_request.result_json,v_request.session_id,v_request.claim_token,v_request.generation,v_request.lease_until,true;
      return;
    end if;
    return query select v_request.request_id,v_request.state,v_request.result_json,v_request.session_id,v_request.claim_token,v_request.generation,v_request.lease_until,false;
    return;
  end if;
  insert into public.journal_ask_requests (user_id,request_id,question,source_entry_id,volume_id,state,lease_until,claim_token,generation)
  values (p_user_id,p_request_id,v_question,p_source_entry_id,p_volume_id,'processing',now()+interval '60 seconds',v_token,1) returning * into v_request;
  return query select v_request.request_id,v_request.state,v_request.result_json,v_request.session_id,v_request.claim_token,v_request.generation,v_request.lease_until,true;
end;
$$;

create or replace function public.complete_ask_request(p_user_id uuid,p_request_id uuid,p_claim_token uuid,p_generation integer,p_result jsonb)
returns public.journal_ask_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.journal_ask_requests%rowtype;
begin
  update public.journal_ask_requests set state='generated', result_json=p_result, lease_until=null
  where user_id=p_user_id and request_id=p_request_id and state='processing' and claim_token=p_claim_token and generation=p_generation
  returning * into v_request;
  if found then return v_request; end if;
  select * into v_request from public.journal_ask_requests where user_id=p_user_id and request_id=p_request_id;
  if not found then raise exception 'ASK_REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  return v_request;
end;
$$;

create or replace function public.save_ask_result(p_user_id uuid,p_request_id uuid)
returns public.journal_ask_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.journal_ask_requests%rowtype; v_session_id uuid;
begin
  select * into v_request from public.journal_ask_requests where user_id=p_user_id and request_id=p_request_id for update;
  if not found then raise exception 'ASK_REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  if v_request.state='saved' then return v_request; end if;
  if v_request.state <> 'generated' or v_request.result_json is null then raise exception 'ASK_RESULT_NOT_READY' using errcode='P0001'; end if;
  -- Historical ask_sessions still references public.users; retain compatibility if an
  -- old auth trigger did not create the companion row before this server-side save.
  insert into public.users (id) values (p_user_id) on conflict (id) do nothing;
  insert into public.ask_sessions (user_id,request_id,source_entry_id,volume_id,question,matched_chapter_id,ai_response,follow_up_question,ai_provider,degraded,fallback_reason)
  values (p_user_id,p_request_id,v_request.source_entry_id,v_request.volume_id,v_request.question,
    (v_request.result_json->>'matchedChapter')::smallint,v_request.result_json->>'interpretation',nullif(v_request.result_json->>'followUpQuestion',''),
    v_request.result_json->>'provider',coalesce((v_request.result_json->>'degraded')::boolean,false),nullif(v_request.result_json->>'fallbackReason',''))
  on conflict (user_id,request_id) do update set request_id=excluded.request_id returning id into v_session_id;
  update public.journal_ask_requests set state='saved',session_id=v_session_id where user_id=p_user_id and request_id=p_request_id returning * into v_request;
  return v_request;
end;
$$;

revoke all on function public.claim_ask_request(uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_ask_request(uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.save_ask_result(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_ask_request(uuid,uuid,text,uuid,uuid) to service_role;
grant execute on function public.complete_ask_request(uuid,uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.save_ask_result(uuid,uuid) to service_role;
