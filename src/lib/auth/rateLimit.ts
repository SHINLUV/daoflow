import { createHmac } from 'node:crypto'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasTrustedProxyAttestation } from './http'
import { runtimeEnv } from '../runtime-env'

type LimitResult =
  | { kind: 'allowed' }
  | { kind: 'limited'; retryAfterSeconds: number }
  | { kind: 'unavailable' }

type LimitConfig = { action: string; limit: number; windowSeconds: number }

const OTP_LIMIT: LimitConfig = { action: 'otp_request', limit: 5, windowSeconds: 60 * 60 }
const SIGN_UP_LIMIT: LimitConfig = { action: 'password_sign_up', limit: 5, windowSeconds: 60 * 60 }
const RECOVERY_LIMIT: LimitConfig = { action: 'password_recovery', limit: 5, windowSeconds: 60 * 60 }
const PASSWORD_FAILURE_LIMIT: LimitConfig = { action: 'password_failure', limit: 10, windowSeconds: 60 * 60 }

function hmacKey(): string | null {
  const key = runtimeEnv('DAOFLOW_RATE_LIMIT_HMAC_KEY')
  return key && key.length >= 32 ? key : null
}

function stableKey(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('base64url')
}

/**
 * Next route handlers cannot safely infer the TCP peer. We therefore accept an
 * IP only when the reverse proxy supplies an unforgeable per-hop attestation.
 * Without both values the caller must fail closed rather than trust X-Forwarded-For.
 */
function trustedClientIp(request: NextRequest): string | null {
  if (!hasTrustedProxyAttestation(request)) return null
  const ip = request.headers.get('x-daoflow-client-ip')
  return ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null
}

/** A server-only, non-reversible bucket for the anonymous AI daily limit. */
export function anonymousAiIpSubject(request: NextRequest): string | null {
  const secret = hmacKey()
  const ip = trustedClientIp(request)
  return secret && ip ? stableKey(ip, secret) : null
}

function requestLimitKeys(request: NextRequest, email: string): { emailKey: string; ipKey: string } | null {
  const secret = hmacKey()
  const ip = trustedClientIp(request)
  return secret && ip ? { emailKey: stableKey(email, secret), ipKey: stableKey(ip, secret) } : null
}

export async function consumeUnauthenticatedLimit(client: SupabaseClient, request: NextRequest, email: string, config: LimitConfig = OTP_LIMIT): Promise<LimitResult> {
  const keys = requestLimitKeys(request, email)
  if (!keys) return { kind: 'unavailable' }

  const { data, error } = await client.rpc('consume_auth_rate_limit', {
    p_action: config.action,
    p_email_key: keys.emailKey,
    p_ip_key: keys.ipKey,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return { kind: 'unavailable' }
  const value = data as { allowed?: unknown; retry_after_seconds?: unknown }
  if (value.allowed !== true) {
    const retryAfterSeconds = typeof value.retry_after_seconds === 'number' && value.retry_after_seconds > 0 ? Math.ceil(value.retry_after_seconds) : 60
    return { kind: 'limited', retryAfterSeconds }
  }
  return { kind: 'allowed' }
}

/** Checks the persistent failure budget without incrementing it. */
export async function checkUnauthenticatedLimit(client: SupabaseClient, request: NextRequest, email: string, config: LimitConfig = PASSWORD_FAILURE_LIMIT): Promise<LimitResult> {
  const keys = requestLimitKeys(request, email)
  if (!keys) return { kind: 'unavailable' }
  const { data, error } = await client.rpc('check_auth_rate_limit', {
    p_action: config.action,
    p_email_key: keys.emailKey,
    p_ip_key: keys.ipKey,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return { kind: 'unavailable' }
  const value = data as { allowed?: unknown; retry_after_seconds?: unknown }
  return value.allowed === true
    ? { kind: 'allowed' }
    : { kind: 'limited', retryAfterSeconds: typeof value.retry_after_seconds === 'number' && value.retry_after_seconds > 0 ? Math.ceil(value.retry_after_seconds) : 60 }
}

export const authRateLimits = { otp: OTP_LIMIT, signUp: SIGN_UP_LIMIT, recovery: RECOVERY_LIMIT, passwordFailure: PASSWORD_FAILURE_LIMIT }
