-- DaoFlow V2 incremental repair for an already-applied 005_ask_links migration.
-- Do not edit or replay 005 on an existing database.

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
  if p_user_id is null or p_request_id is null or char_length(v_question) not between 1 and 500 then
    raise exception 'INVALID_ASK_REQUEST' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(0, hashtext(p_user_id::text || ':' || p_request_id::text));
  select * into v_request
  from public.journal_ask_requests
  where user_id = p_user_id and request_id = p_request_id
  for update;

  -- A replay is governed by its immutable original payload. Later recycle/archive
  -- state must not hide an already generated or saved result from its owner.
  if found then
    if v_request.question is distinct from v_question
       or v_request.source_entry_id is distinct from p_source_entry_id
       or v_request.volume_id is distinct from p_volume_id then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    if v_request.state = 'processing' and v_request.lease_until <= now() then
      update public.journal_ask_requests
      set claim_token = v_token, generation = generation + 1, lease_until = now() + interval '60 seconds'
      where user_id = p_user_id and request_id = p_request_id
      returning * into v_request;
      return query select v_request.request_id,v_request.state,v_request.result_json,v_request.session_id,v_request.claim_token,v_request.generation,v_request.lease_until,true;
      return;
    end if;
    return query select v_request.request_id,v_request.state,v_request.result_json,v_request.session_id,v_request.claim_token,v_request.generation,v_request.lease_until,false;
    return;
  end if;

  -- Only a brand-new request may select a currently active owned source/volume.
  -- This validation still happens atomically before the route is allowed to call a model.
  if p_source_entry_id is not null and not exists (
    select 1 from public.journal_entries
    where id = p_source_entry_id and user_id = p_user_id and deleted_at is null
  ) then
    raise exception 'SOURCE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_volume_id is not null and not exists (
    select 1 from public.journal_volumes
    where id = p_volume_id and user_id = p_user_id and archived_at is null
  ) then
    raise exception 'VOLUME_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.journal_ask_requests (user_id,request_id,question,source_entry_id,volume_id,state,lease_until,claim_token,generation)
  values (p_user_id,p_request_id,v_question,p_source_entry_id,p_volume_id,'processing',now()+interval '60 seconds',v_token,1)
  returning * into v_request;
  return query select v_request.request_id,v_request.state,v_request.result_json,v_request.session_id,v_request.claim_token,v_request.generation,v_request.lease_until,true;
end;
$$;

revoke all on function public.claim_ask_request(uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_ask_request(uuid,uuid,text,uuid,uuid) to service_role;
