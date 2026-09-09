/**
 * Auth 回调 — 魔法链接 code 交换
 *
 * Supabase 发送的魔法链接包含 code 参数。
 * 此路由负责将 code 交换为 session cookie，
 * 然后重定向到目标页面。
 */
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/safeNext'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = callbackOrigin(request, requestUrl)
  const code = requestUrl.searchParams.get('code')
  const next = safeNext(requestUrl.searchParams.get('next'))

  if (!isSupabaseConfigured) {
    return authFailureRedirect(origin, 'unavailable', next)
  }

  if (code) {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        return authFailureRedirect(origin, 'failed', next)
      }
    } catch {
      return authFailureRedirect(origin, 'unavailable', next)
    }
  }

  if (!code) {
    return authFailureRedirect(origin, 'missing-code', next)
  }

  return NextResponse.redirect(new URL(next, origin))
}

function callbackOrigin(request: Request, requestUrl: URL) {
  // `next start` can normalize request.url to localhost even when a browser
  // reached the loopback address by IP. Only restore explicitly supported local
  // origins; never reflect an arbitrary Host header into an auth redirect.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host === '127.0.0.1:3200' || host === 'localhost:3200') return `http://${host}`
  return requestUrl.origin
}

function authFailureRedirect(origin: string, status: string, next: string) {
  const destination = new URL('/my-dao', origin)
  destination.searchParams.set('auth', status)
  destination.searchParams.set('next', next)
  return NextResponse.redirect(destination)
}
