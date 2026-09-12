import { createServerClient, type CookieOptions, type CookieOptionsWithName, type CookieMethodsServer } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { clearCsrfToken, isProduction, isProductionForHost, noStoreHeaders } from './http'
import { getSupabaseCookieName } from '../supabase/storage-key'
import { runtimeEnv } from '../runtime-env'

type PendingCookie = { name: string; value: string; options: CookieOptions }
type RecoveryProof = { userId: string; sessionBinding: string; expiresAt: number }

const AUTH_COOKIE_PROD = '__Host-daoflow-auth'
const AUTH_COOKIE_DEV = 'daoflow-dev-auth'
const MFA_RECENT_COOKIE_PROD = '__Host-daoflow-mfa-recent'
const MFA_RECENT_COOKIE_DEV = 'daoflow-dev-mfa-recent'
const RECOVERY_COOKIE_PROD = '__Host-daoflow-recovery'
const RECOVERY_COOKIE_DEV = 'daoflow-dev-recovery'
const TRANSACTION_COOKIE_PROD = '__Host-daoflow-auth-tx'
const TRANSACTION_COOKIE_DEV = 'daoflow-dev-auth-tx'

export type AuthBff = {
  client: SupabaseClient
  apply: (response: NextResponse) => NextResponse
}

export function authCookieName(request?: NextRequest): string { return isProduction(request) ? AUTH_COOKIE_PROD : AUTH_COOKIE_DEV }
export function authCookieNameForHost(host: string | null | undefined): string { return isProductionForHost(host) ? AUTH_COOKIE_PROD : AUTH_COOKIE_DEV }
export function mfaRecentCookieName(request?: NextRequest): string { return isProduction(request) ? MFA_RECENT_COOKIE_PROD : MFA_RECENT_COOKIE_DEV }
export function recoveryCookieName(request?: NextRequest): string { return isProduction(request) ? RECOVERY_COOKIE_PROD : RECOVERY_COOKIE_DEV }
export function transactionCookieName(request?: NextRequest): string { return isProduction(request) ? TRANSACTION_COOKIE_PROD : TRANSACTION_COOKIE_DEV }

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function createAuthBff(request: NextRequest): AuthBff {
  const pending: PendingCookie[] = []
  const methods: CookieMethodsServer = {
    getAll: () => {
      const all = request.cookies.getAll()
      // One-way compatibility for an already-issued legacy magic-link PKCE
      // verifier. The callback can exchange it into the new HttpOnly BFF
      // session, but no legacy token is ever returned by this BFF.
      const legacyName = getSupabaseCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL)
      const legacyVerifier = legacyName ? request.cookies.get(`${legacyName}-code-verifier`) : undefined
      if (legacyVerifier && !request.cookies.get(`${authCookieName(request)}-code-verifier`)) {
        all.push({ name: `${authCookieName(request)}-code-verifier`, value: legacyVerifier.value })
      }
      return all
    },
    setAll: cookies => { pending.push(...cookies) },
  }
  const client = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://supabase-not-configured.invalid',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key-not-configured',
    {
      cookieOptions: {
        name: authCookieName(request),
        httpOnly: true,
        secure: isProduction(request),
        sameSite: 'lax',
        path: '/',
      } satisfies CookieOptionsWithName,
      cookies: methods,
    },
  )
  return {
    client,
    apply(response) {
      pending.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }))
      return response
    },
  }
}

export function clearCookie(response: NextResponse, name: string, request?: NextRequest): void {
  response.cookies.set({ name, value: '', httpOnly: true, secure: isProduction(request), sameSite: 'lax', path: '/', maxAge: 0 })
}

export function clearAuthCookies(response: NextResponse, request?: NextRequest): void {
  clearCookie(response, authCookieName(request), request)
  // Supabase may chunk an oversized session. Clear the bounded chunk names too;
  // a hostile cookie name is never reflected back.
  for (let index = 0; index < 8; index += 1) clearCookie(response, `${authCookieName(request)}.${index}`, request)
  clearCookie(response, mfaRecentCookieName(request), request)
  clearCookie(response, recoveryCookieName(request), request)
  clearCookie(response, transactionCookieName(request), request)
  const legacyName = getSupabaseCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (legacyName) {
    clearCookie(response, legacyName, request)
    clearCookie(response, `${legacyName}-code-verifier`, request)
  }
  clearCsrfToken(response, request)
}

export function markMfaRecent(response: NextResponse, request: NextRequest): void {
  response.cookies.set({ name: mfaRecentCookieName(request), value: crypto.randomUUID(), httpOnly: true, secure: isProduction(request), sameSite: 'strict', path: '/', maxAge: 15 * 60 })
}

export function hasRecentMfa(request: NextRequest): boolean {
  return Boolean(request.cookies.get(mfaRecentCookieName(request))?.value)
}

function recoveryProofSecret(): string | null {
  const secret = runtimeEnv('DAOFLOW_AUTH_TRANSACTION_SECRET')
  return secret && secret.length >= 32 ? secret : null
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - value.length % 4) % 4)}`
    const binary = atob(padded)
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    return null
  }
}

async function recoverySignature(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return encodeBase64Url(new Uint8Array(signature))
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

async function recoverySessionBinding(accessToken: string, secret: string): Promise<string> {
  return recoverySignature(`recovery-session-v1:${accessToken}`, secret)
}

async function encodeRecoveryProof(proof: RecoveryProof, secret: string): Promise<string> {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(proof)))
  return `${payload}.${await recoverySignature(payload, secret)}`
}

async function decodeRecoveryProof(value: string | undefined, secret: string): Promise<RecoveryProof | null> {
  if (!value) return null
  const [payload, signature, ...rest] = value.split('.')
  if (!payload || !signature || rest.length) return null
  const expected = decodeBase64Url(await recoverySignature(payload, secret))
  const supplied = decodeBase64Url(signature)
  if (!expected || !supplied || !constantTimeEqual(expected, supplied)) return null
  try {
    const payloadBytes = decodeBase64Url(payload)
    if (!payloadBytes) return null
    const proof = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<RecoveryProof>
    if (typeof proof.userId !== 'string' || typeof proof.sessionBinding !== 'string' || typeof proof.expiresAt !== 'number') return null
    if (proof.expiresAt < Date.now() || proof.expiresAt > Date.now() + 20 * 60 * 1000) return null
    return { userId: proof.userId, sessionBinding: proof.sessionBinding, expiresAt: proof.expiresAt }
  } catch {
    return null
  }
}

/**
 * Recovery proof is signed server-side and binds the verified recovery user to
 * the exact BFF Auth session. It never contains the token itself.
 */
export async function markRecoverySession(response: NextResponse, userId: string, accessToken: string, request: NextRequest): Promise<boolean> {
  const secret = recoveryProofSecret()
  if (!secret || !userId || !accessToken) return false
  const proof: RecoveryProof = {
    userId,
    sessionBinding: await recoverySessionBinding(accessToken, secret),
    expiresAt: Date.now() + 15 * 60 * 1000,
  }
  response.cookies.set({ name: recoveryCookieName(request), value: await encodeRecoveryProof(proof, secret), httpOnly: true, secure: isProduction(request), sameSite: 'strict', path: '/', maxAge: 15 * 60 })
  return true
}

/** Returns true only for the same currently authenticated Auth session. */
export async function hasBoundRecoverySession(request: NextRequest, userId: string, accessToken: string): Promise<boolean> {
  const secret = recoveryProofSecret()
  if (!secret || !userId || !accessToken) return false
  const proof = await decodeRecoveryProof(request.cookies.get(recoveryCookieName(request))?.value, secret)
  if (!proof || proof.userId !== userId) return false
  const expected = decodeBase64Url(await recoverySessionBinding(accessToken, secret))
  const supplied = decodeBase64Url(proof.sessionBinding)
  return Boolean(expected && supplied && constantTimeEqual(expected, supplied))
}

export function noStoreRedirect(location: URL): NextResponse {
  return NextResponse.redirect(location, { headers: noStoreHeaders() })
}
