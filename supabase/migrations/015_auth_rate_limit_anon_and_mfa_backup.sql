-- Repair the already-applied 013 grant without rewriting migration history.
-- These functions receive only HMAC bucket identifiers. Their existing action,
-- limit, window, and key-shape validation remains in force; anon callers never
-- receive raw emails, client IPs, session data, or table access.
begin;

revoke all on function public.consume_auth_rate_limit(text, text, text, integer, integer) from public;
revoke all on function public.check_auth_rate_limit(text, text, text, integer, integer) from public;
grant execute on function public.consume_auth_rate_limit(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.check_auth_rate_limit(text, text, text, integer, integer) to anon, authenticated;

-- Stable GoTrue recovery is a separately verified backup TOTP factor. The old
-- placeholder could never be true and made that strategy unreachable.
do $$
begin
  if to_regprocedure('public.has_mfa_recovery_factor()') is not null then
    execute 'revoke all on function public.has_mfa_recovery_factor() from public, anon, authenticated';
    execute 'drop function public.has_mfa_recovery_factor()';
  end if;
end;
$$;

commit;
