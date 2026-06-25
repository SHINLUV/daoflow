/**
 * POST /api/ask — 问道核心接口
 *
 * 接收用户困惑 → 三级降级调度 → 写入会话记录 → 返回匹配章节与解读
 */

import { NextRequest, NextResponse } from 'next/server'
import { askDao } from '@/lib/ai/askDao'

const MAX_QUESTION_LENGTH = 500

export async function POST(request: NextRequest) {
  // 1. 输入校验
  let question: string
  try {
    const body = await request.json()
    question = body.question?.trim()
  } catch {
    return NextResponse.json(
      { error: '请求体必须是合法的 JSON' },
      { status: 400 }
    )
  }

  if (!question) {
    return NextResponse.json(
      { error: 'question 不能为空' },
      { status: 400 }
    )
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `question 长度不能超过 ${MAX_QUESTION_LENGTH} 字` },
      { status: 400 }
    )
  }

  // 2. 三级降级调度
  const result = await askDao(question)

  // 3. 写入 ask_sessions
  // 如果用户已登录，关联 user_id；否则匿名保存
  // 不阻塞请求，容错处理
  let sessionId: string | null = null

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()

    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser()

    // 确保 users 表存在对应行（防止触发器未触发导致 FK 约束失败）
    if (user) {
      await supabase
        .from('users')
        .upsert({ id: user.id }, { onConflict: 'id' })
        .select('id')
        .maybeSingle()
    }

    const { data: session, error: insertError } = await supabase
      .from('ask_sessions')
      .insert({
        user_id: user?.id ?? null,
        question,
        matched_chapter_id: result.matchedChapter,
        ai_response: result.interpretation,
        follow_up_question: result.followUpQuestion,
        ai_provider: result.provider,
        degraded: result.degraded,
        fallback_reason: result.fallbackReason,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[api/ask] 会话写入失败:', insertError)
    } else if (session) {
      sessionId = session.id
    }
  } catch (dbError) {
    // 数据库写入失败不影响用户返回（降级策略）
    console.error('[api/ask] 会话写入异常:', dbError)
  }

  // 4. 获取匹配章节的原文（原文是主角）
  let originalText: string | null = null

  if (result.matchedChapter) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = createClient()
      const { data: ch } = await supabase
        .from('chapters')
        .select('original_text')
        .eq('id', result.matchedChapter)
        .single()
      if (ch) originalText = ch.original_text
    } catch {
      // 降级：无原文不影响核心体验
    }
  }

  // 5. 返回统一结构
  return NextResponse.json({
    matchedChapter: result.matchedChapter,
    originalText,
    interpretation: result.interpretation,
    followUpQuestion: result.followUpQuestion,
    sessionId,
    meta: {
      provider: result.provider,
      degraded: result.degraded,
    },
  })
}
