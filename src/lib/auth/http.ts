import { NextRequest, NextResponse } from 'next/server'
import type { ApiErrorCode, ApiFailure } from './contracts'
import { runtimeEnv } from '../runtime-env'

const CSRF_HEADER = 'x-daoflow-csrf'
const CSRF_COOKIE_PROD = '__Host-daoflow-csrf'
const CSRF_COOKIE_DEV = 'daoflow-dev-csrf'

export function requestId(): string {
  return crypto.randomUUID()
}

function isLoopbackHost(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const host = new URL(`http://${value}`).hostname.toLowerCase()
    return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]'
  } catch {
    return false
  }
}

/**
 * A standalone local build has NODE_ENV=production. Downgrade cookie semantics
 * only when its launcher explicitly marks it local, binds to loopback, and the
 * request itself is addressed to loopback. Missing request context is secure by
 * default and therefore remains production.
 */
export function isExplicitLocalRuntimeForHost(host: string | null | undefined): boolean {
  return process.env.NODE_ENV === 'production'
    && runtimeEnv('DAOFLOW_LOCAL_RUNTIME') === 'true'
    && runtimeEnv('HOSTNAME') !== undefined
    && isLoopbackHost(runtimeEnv('HOSTNAME'))
    && isLoopbackHost(host)
}

export function isExplicitLocalRuntime(request?: NextRequest): boolean {
  if (!request) return false
  return isExplicitLocalRuntimeForHost(request.headers.get('host'))
    && isLoopbackHost(request.nextUrl.hostname)
}

export function isProductionForHost(host: string | null | undefined): boolean {
  return process.env.NODE_ENV === 'production' && !isExplicitLocalRuntimeForHost(host)
}

export function isProduction(request?: NextRequest): boolean {
  return process.env.NODE_ENV === 'production' && !isExplicitLocalRuntime(request)
}

export function csrfCookieName(request?: NextRequest): string {
  return isProduction(request) ? CSRF_COOKIE_PROD : CSRF_COOKIE_DEV
}

export function noStoreHeaders(): HeadersInit {
  return {
    'cache-control': 'no-store, private, max-age=0',
    pragma: 'no-cache',
    vary: 'cookie, origin',
  }
}

export function json<T>(payload: T, status = 200): NextResponse<T> {
  return NextResponse.json<T>(payload, { status, headers: noStoreHeaders() })
}

export function empty(status = 204): NextResponse {
  return new NextResponse(null, { status, headers: noStoreHeaders() })
}

export function failure(status: number, code: ApiErrorCode, message: string, id = requestId()): NextResponse<ApiFailure> {
  return json<ApiFailure>({ error: { code, message, requestId: id } }, status)
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

/** The proxy attestation is the sole authority for forwarded client metadata. */
export function hasTrustedProxyAttestation(request: NextRequest): boolean {
  const expected = runtimeEnv('DAOFLOW_PROXY_ATTESTATION_SECRET')
  const supplied = request.headers.get('x-daoflow-proxy-attestation')
  return Boolean(expected && supplied && constantTimeEqual(supplied, expected))
}

function trustedForwardedOrigin(request: NextRequest): string | null {
  if (!hasTrustedProxyAttestation(request)) return null
  const host = request.headers.get('x-forwarded-host')
  const proto = request.headers.get('x-forwarded-proto')?.toLowerCase()
  if (!host || !proto || (proto !== 'http' && proto !== 'https') || host.includes(',') || /\s/.test(host)) return null
  try {
    const origin = new URL(`${proto}://${host}`)
    if (origin.protocol !== `${proto}:` || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null
    return origin.origin
  } catch {
    return null
  }
}

/** Browser-facing authority, using forwarded metadata only from an attested proxy hop. */
export function browserOrigin(request: NextRequest): string {
  return trustedForwardedOrigin(request) ?? request.nextUrl.origin
}

export function originIsSameSite(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  return origin === browserOrigin(request)
}

/** All state-changing browser endpoints require an exact same-origin Origin and double-submit CSRF value. */
export function verifyMutationRequest(request: NextRequest): { ok: true } | { ok: false; code: 'ORIGIN_REJECTED' | 'CSRF_REJECTED'; message: string } {
  if (!originIsSameSite(request)) return { ok: false, code: 'ORIGIN_REJECTED', message: '此请求不是从 DaoFlow 当前站点发起。' }
  const cookie = request.cookies.get(csrfCookieName(request))?.value
  const header = request.headers.get(CSRF_HEADER)
  if (!cookie || !header || !constantTimeEqual(cookie, header)) return { ok: false, code: 'CSRF_REJECTED', message: '安全校验已失效，请刷新页面后重试。' }
  return { ok: true }
}

export function csrfTokenFor(request: NextRequest): string {
  const current = request.cookies.get(csrfCookieName(request))?.value
  return current && /^[A-Za-z0-9_-]{32,}$/.test(current) ? current : crypto.getRandomValues(new Uint8Array(32)).reduce((value, byte) => value + byte.toString(16).padStart(2, '0'), '')
}

export function issueCsrfToken(request: NextRequest, response: NextResponse, suppliedToken?: string): string {
  const token = suppliedToken ?? csrfTokenFor(request)
  response.cookies.set({
    name: csrfCookieName(request),
    value: token,
    httpOnly: false,
    sameSite: 'strict',
    secure: isProduction(request),
    path: '/',
  })
  return token
}

export function clearCsrfToken(response: NextResponse, request?: NextRequest): void {
  response.cookies.set({ name: csrfCookieName(request), value: '', httpOnly: false, sameSite: 'strict', secure: isProduction(request), path: '/', maxAge: 0 })
}

export async function readJson(request: NextRequest): Promise<unknown | null> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) return null
  const length = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(length) && length > 16 * 1024) return null
  try {
    return await request.json()
  } catch {
    return null
  }
}
