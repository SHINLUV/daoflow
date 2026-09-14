begin;

-- Product decision (2026-09-15): anonymous visitors no longer have a
-- per-IP daily request quota. Keep the short-lived per-IP lease, the global
-- two-generation capacity guard and the global daily cost ceiling so one
-- caller cannot create unbounded concurrent upstream work.
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
  if p_ip_subject !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'INVALID_IP_BUCKET' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(0, 628055);
  delete from public.ai_generation_leases where expires_at <= now();

  if (select count(*) from public.ai_generation_leases where expires_at > now()) >= 2 then
    raise exception 'GLOBAL_GENERATION_CAPACITY' using errcode = 'P0007';
  end if;

  if exists (
    select 1
    from public.ai_generation_leases
    where scope = 'anonymous'
      and subject = p_ip_subject
      and expires_at > now()
  ) then
    raise exception 'ANONYMOUS_GENERATION_CAPACITY' using errcode = 'P0007';
  end if;

  insert into public.ai_rate_limits(scope, subject, period_start, request_count)
  values ('global', 'ask', current_date, 1)
  on conflict (scope, subject, period_start) do update
    set request_count = public.ai_rate_limits.request_count + 1,
        updated_at = now()
  where public.ai_rate_limits.request_count < 300
  returning request_count into v_count;

  if v_count is null then
    raise exception 'GLOBAL_DAILY_LIMIT' using errcode = 'P0007';
  end if;

  insert into public.ai_generation_leases(lease_id, scope, subject, expires_at)
  values (v_lease_id, 'anonymous', p_ip_subject, now() + interval '75 seconds');

  return jsonb_build_object(
    'leaseId', v_lease_id,
    'expiresAt', now() + interval '75 seconds'
  );
end;
$$;

revoke all on function public.reserve_anonymous_ask(text) from public, anon, authenticated;
grant execute on function public.reserve_anonymous_ask(text) to service_role;

commit;
