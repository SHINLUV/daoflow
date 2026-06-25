/**
 * GET /api/me/history — 我的道·问道记录
 *
 * 返回当前用户最近 5 条问道记录。
 * 未登录返回 401。
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  // 验证登录态
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: '请先登录' },
      { status: 401 }
    )
  }

  // 查询最近 5 条记录
  const { data: sessions, error } = await supabase
    .from('ask_sessions')
    .select('id, question, ai_response, follow_up_question, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('[api/me/history] 查询失败:', error)
    return NextResponse.json(
      { error: '查询失败，请稍后重试' },
      { status: 500 }
    )
  }

  return NextResponse.json({ sessions: sessions || [] })
}
