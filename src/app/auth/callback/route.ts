/**
 * Auth 回调 — 魔法链接 code 交换
 *
 * Supabase 发送的魔法链接包含 code 参数。
 * 此路由负责将 code 交换为 session cookie，
 * 然后重定向到目标页面。
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/my-dao'

  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // 重定向到目标页面（同源安全）
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
