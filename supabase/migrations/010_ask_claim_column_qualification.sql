-- Forward-only repair for 009_ask_runtime_repairs.sql on databases where it
-- has already been applied. Output-column variables in a RETURNS TABLE
-- function shadow unqualified column names in PL/pgSQL.

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
  from public.journal_ask_requests as existing_request
  where existing_request.user_id = p_user_id and existing_request.request_id = p_request_id
  for update;

  if found then
    if v_request.question is distinct from v_question
       or v_request.source_entry_id is distinct from p_source_entry_id
       or v_request.volume_id is distinct from p_volume_id then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    if v_request.state = 'processing' and v_request.lease_until <= now() then
      update public.journal_ask_requests as existing_request
      set claim_token = v_token, generation = generation + 1, lease_until = now() + interval '60 seconds'
      where existing_request.user_id = p_user_id and existing_request.request_id = p_request_id
      returning * into v_request;
      return query select v_request.request_id,v_request.state,v_request.result_json,v_request.session_id,v_request.claim_token,v_request.generation,v_request.lease_until,true;
      return;
    end if;
    return query select v_request.request_id,v_request.state,v_request.result_json,v_request.session_id,v_request.claim_token,v_request.generation,v_request.lease_until,false;
    return;
  end if;

  if p_source_entry_id is not null and not exists (
    select 1 from public.journal_entries as source_entry
    where source_entry.id = p_source_entry_id and source_entry.user_id = p_user_id and source_entry.deleted_at is null
  ) then
    raise exception 'SOURCE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_volume_id is not null and not exists (
    select 1 from public.journal_volumes as source_volume
    where source_volume.id = p_volume_id and source_volume.user_id = p_user_id and source_volume.archived_at is null
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
