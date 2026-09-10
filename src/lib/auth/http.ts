import { NextRequest, NextResponse } from 'next/server'
import type { ApiErrorCode, ApiFailure } from './contracts'

const CSRF_HEADER = 'x-daoflow-csrf'
const CSRF_COOKIE_PROD = '__Host-daoflow-csrf'
const CSRF_COOKIE_DEV = 'daoflow-dev-csrf'

export function requestId(): string {
  return crypto.randomUUID()
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function csrfCookieName(): string {
  return isProduction() ? CSRF_COOKIE_PROD : CSRF_COOKIE_DEV
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

export function originIsSameSite(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  return origin !== null && origin === request.nextUrl.origin
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

/** All state-changing browser endpoints require an exact same-origin Origin and double-submit CSRF value. */
export function verifyMutationRequest(request: NextRequest): { ok: true } | { ok: false; code: 'ORIGIN_REJECTED' | 'CSRF_REJECTED'; message: string } {
  if (!originIsSameSite(request)) return { ok: false, code: 'ORIGIN_REJECTED', message: '此请求不是从 DaoFlow 当前站点发起。' }
  const cookie = request.cookies.get(csrfCookieName())?.value
  const header = request.headers.get(CSRF_HEADER)
  if (!cookie || !header || !constantTimeEqual(cookie, header)) return { ok: false, code: 'CSRF_REJECTED', message: '安全校验已失效，请刷新页面后重试。' }
  return { ok: true }
}

export function csrfTokenFor(request: NextRequest): string {
  const current = request.cookies.get(csrfCookieName())?.value
  return current && /^[A-Za-z0-9_-]{32,}$/.test(current) ? current : crypto.getRandomValues(new Uint8Array(32)).reduce((value, byte) => value + byte.toString(16).padStart(2, '0'), '')
}

export function issueCsrfToken(request: NextRequest, response: NextResponse, suppliedToken?: string): string {
  const token = suppliedToken ?? csrfTokenFor(request)
  response.cookies.set({
    name: csrfCookieName(),
    value: token,
    httpOnly: false,
    sameSite: 'strict',
    secure: isProduction(),
    path: '/',
  })
  return token
}

export function clearCsrfToken(response: NextResponse): void {
  response.cookies.set({ name: csrfCookieName(), value: '', httpOnly: false, sameSite: 'strict', secure: isProduction(), path: '/', maxAge: 0 })
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
