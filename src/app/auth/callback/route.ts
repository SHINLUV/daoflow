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
    return NextResponse.redirect(new URL('/my-dao?auth=unavailable', requestUrl.origin))
  }

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/my-dao?auth=failed', requestUrl.origin))
    }
  }

  if (!code) {
    return NextResponse.redirect(new URL('/my-dao?auth=missing-code', requestUrl.origin))
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
