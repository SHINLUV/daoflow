import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getLocalChapter } from '@/lib/chapters'
import { isAskRequestId } from '@/lib/journal/ask-requests'

export async function GET(_request: NextRequest, { params }: { params: { sessionId: string } }) {
  const requestId = crypto.randomUUID()
  if (!isAskRequestId(params.sessionId)) return failure(400, 'INVALID_SESSION_ID', 'sessionId 必须是 UUID。', requestId)
  if (!isSupabaseConfigured) return failure(503, 'SUPABASE_UNAVAILABLE', '私人问道历史服务尚未配置。', requestId)

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return failure(401, 'AUTH_REQUIRED', '请先登录后查看问道历史。', requestId)

  const { data, error } = await supabase
    .from('ask_sessions')
    .select('id,question,matched_chapter_id,ai_response,follow_up_question,ai_provider,degraded,fallback_reason,source_entry_id,volume_id,created_at')
    .eq('id', params.sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return failure(500, 'ASK_SESSION_READ_FAILED', '暂时无法读取这条问道记录。', requestId)
  if (!data) return failure(404, 'ASK_SESSION_NOT_FOUND', '未找到这条问道记录，或你没有权限查看。', requestId)

  const chapter = getLocalChapter(data.matched_chapter_id)
  return NextResponse.json({
    session: {
      id: data.id,
      question: data.question,
      matchedChapter: data.matched_chapter_id,
      originalText: chapter?.original_text ?? null,
      interpretation: data.ai_response,
      followUpQuestion: data.follow_up_question,
      provider: data.ai_provider,
      degraded: data.degraded,
      fallbackReason: data.fallback_reason,
      sourceEntryId: data.source_entry_id,
      volumeId: data.volume_id,
      createdAt: data.created_at,
    },
  })
}

function failure(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ error: { code, message }, requestId }, { status })
}
