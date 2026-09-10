import { createServerClient, type CookieOptions, type CookieOptionsWithName, type CookieMethodsServer } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { clearCsrfToken, isProduction, noStoreHeaders } from './http'
import { getSupabaseCookieName } from '../supabase/storage-key'

type PendingCookie = { name: string; value: string; options: CookieOptions }

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

export function authCookieName(): string { return isProduction() ? AUTH_COOKIE_PROD : AUTH_COOKIE_DEV }
export function mfaRecentCookieName(): string { return isProduction() ? MFA_RECENT_COOKIE_PROD : MFA_RECENT_COOKIE_DEV }
export function recoveryCookieName(): string { return isProduction() ? RECOVERY_COOKIE_PROD : RECOVERY_COOKIE_DEV }
export function transactionCookieName(): string { return isProduction() ? TRANSACTION_COOKIE_PROD : TRANSACTION_COOKIE_DEV }

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

const cookieOptions: CookieOptionsWithName = {
  name: authCookieName(),
  httpOnly: true,
  secure: isProduction(),
  sameSite: 'lax',
  path: '/',
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
      if (legacyVerifier && !request.cookies.get(`${authCookieName()}-code-verifier`)) {
        all.push({ name: `${authCookieName()}-code-verifier`, value: legacyVerifier.value })
      }
      return all
    },
    setAll: cookies => { pending.push(...cookies) },
  }
  const client = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://supabase-not-configured.invalid',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key-not-configured',
    { cookieOptions, cookies: methods },
  )
  return {
    client,
    apply(response) {
      pending.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }))
      return response
    },
  }
}

export function clearCookie(response: NextResponse, name: string): void {
  response.cookies.set({ name, value: '', httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 0 })
}

export function clearAuthCookies(response: NextResponse): void {
  clearCookie(response, authCookieName())
  // Supabase may chunk an oversized session. Clear the bounded chunk names too;
  // a hostile cookie name is never reflected back.
  for (let index = 0; index < 8; index += 1) clearCookie(response, `${authCookieName()}.${index}`)
  clearCookie(response, mfaRecentCookieName())
  clearCookie(response, recoveryCookieName())
  clearCookie(response, transactionCookieName())
  const legacyName = getSupabaseCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (legacyName) {
    clearCookie(response, legacyName)
    clearCookie(response, `${legacyName}-code-verifier`)
  }
  clearCsrfToken(response)
}

export function markMfaRecent(response: NextResponse): void {
  response.cookies.set({ name: mfaRecentCookieName(), value: crypto.randomUUID(), httpOnly: true, secure: isProduction(), sameSite: 'strict', path: '/', maxAge: 15 * 60 })
}

export function hasRecentMfa(request: NextRequest): boolean {
  return Boolean(request.cookies.get(mfaRecentCookieName())?.value)
}

export function markRecoverySession(response: NextResponse): void {
  response.cookies.set({ name: recoveryCookieName(), value: crypto.randomUUID(), httpOnly: true, secure: isProduction(), sameSite: 'strict', path: '/', maxAge: 15 * 60 })
}

export function hasRecoverySession(request: NextRequest): boolean {
  return Boolean(request.cookies.get(recoveryCookieName())?.value)
}

export function noStoreRedirect(location: URL): NextResponse {
  return NextResponse.redirect(location, { headers: noStoreHeaders() })
}
