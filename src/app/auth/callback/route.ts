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
  const code = requestUrl.searchParams.get('code')
  const next = safeNext(requestUrl.searchParams.get('next'))

  if (!isSupabaseConfigured) {
    return authFailureRedirect(requestUrl.origin, 'unavailable', next)
  }

  if (code) {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        return authFailureRedirect(requestUrl.origin, 'failed', next)
      }
    } catch {
      return authFailureRedirect(requestUrl.origin, 'unavailable', next)
    }
  }

  if (!code) {
    return authFailureRedirect(requestUrl.origin, 'missing-code', next)
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

function authFailureRedirect(origin: string, status: string, next: string) {
  const destination = new URL('/my-dao', origin)
  destination.searchParams.set('auth', status)
  destination.searchParams.set('next', next)
  return NextResponse.redirect(destination)
}
