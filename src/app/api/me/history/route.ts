/**
 * GET /api/me/history — 我的道·问道记录
 *
 * 返回当前用户最近 5 条问道记录。
 * 未登录返回 401。
 */
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  if (!isSupabaseConfigured) {
    return unavailable()
  }

  try {
    const supabase = createClient()

    // 验证登录态；无会话是客户端状态，网络或 Auth 服务错误是依赖故障。
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user) {
      if (authError && !isInvalidSessionError(authError)) return unavailable()
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: '请先登录。' } },
        { status: 401 }
      )
    }

    // 查询最近 5 条记录
    const { data: sessions, error, status, statusText } = await supabase
      .from('ask_sessions')
      .select('id, question, ai_response, follow_up_question, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      if (isDependencyUnavailableStatus(status)) return unavailable()
      console.error('[api/me/history] 查询失败:', { status, statusText, error })
      return NextResponse.json(
        { error: '查询失败，请稍后重试' },
        { status: 500 }
      )
    }

    return NextResponse.json({ sessions: sessions || [] })
  } catch {
    return unavailable()
  }
}

function isInvalidSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { name?: unknown; status?: unknown; code?: unknown }
  return value.name === 'AuthSessionMissingError'
    || value.status === 401
    || value.code === 'session_not_found'
    || value.code === 'bad_jwt'
    || value.code === 'refresh_token_not_found'
}

function isDependencyUnavailableStatus(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504
}

function unavailable() {
  return NextResponse.json(
    { error: { code: 'SUPABASE_UNAVAILABLE', message: '问道历史服务暂不可用，请稍后重试。' } },
    { status: 503 }
  )
}
