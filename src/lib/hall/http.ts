import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { HallInputError } from './contracts'

export const HALL_CACHE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
}

export type HallHttpError = { status: number; code: string; message: string }

export function requestId(): string {
  return crypto.randomUUID()
}

export function hallJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers)
  for (const [name, value] of Object.entries(HALL_CACHE_HEADERS)) headers.set(name, value)
  return NextResponse.json(body, { ...init, headers })
}

export function hallError(error: HallHttpError, id: string): NextResponse {
  return hallJson({ error: { code: error.code, message: error.message }, requestId: id }, { status: error.status })
}

export function inputError(error: unknown): HallHttpError {
  if (error instanceof HallInputError) return { status: 400, code: 'INVALID_INPUT', message: error.message }
  return { status: 400, code: 'INVALID_INPUT', message: '请求体必须是合法 JSON。' }
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new HallInputError('请求体必须是合法 JSON。')
  }
}

export function requireHallMutationProtection(request: NextRequest): HallHttpError | null {
  const origin = request.headers.get('origin')
  if (!origin || origin !== request.nextUrl.origin) return { status: 403, code: 'ORIGIN_REJECTED', message: '请求来源未获允许。' }

  const csrfCookieName = process.env.NODE_ENV === 'production' ? '__Host-daoflow-csrf' : 'daoflow-dev-csrf'
  const csrfCookie = request.cookies.get(csrfCookieName)?.value
  const csrfHeader = request.headers.get('x-daoflow-csrf')
  if (!csrfCookie || !csrfHeader || !safeEqual(csrfCookie, csrfHeader)) return { status: 403, code: 'CSRF_REQUIRED', message: '请刷新页面后重试。' }
  return null
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
