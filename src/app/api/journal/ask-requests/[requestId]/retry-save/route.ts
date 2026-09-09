import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { hasAskServiceConfiguration, isAskRequestId, saveAskResult, snapshotFromUnknown } from '@/lib/journal/ask-requests'
import { getLocalChapter } from '@/lib/chapters'

export async function POST(_request: NextRequest, { params }: { params: { requestId: string } }) {
  const id = crypto.randomUUID()
  if (!isAskRequestId(params.requestId)) return error(400, 'INVALID_REQUEST_ID', 'requestId 必须是 UUID。', id)
  if (!isSupabaseConfigured || !hasAskServiceConfiguration()) return error(503, 'ASK_SAVE_UNAVAILABLE', '问道保存服务尚未配置。', id)
  const supabase = createClient(); const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return error(401, 'AUTH_REQUIRED', '请先登录后重试保存。', id)
  const { data: existing, error: readError } = await supabase.from('journal_ask_requests').select('state,result_json').eq('request_id', params.requestId).maybeSingle()
  if (readError) return error(500, 'ASK_REQUEST_READ_FAILED', '暂时无法读取问道结果。', id)
  if (!existing) return error(404, 'ASK_REQUEST_NOT_FOUND', '未找到该问道请求。', id)
  if (existing.state !== 'generated' && existing.state !== 'saved') return error(409, 'ASK_RESULT_NOT_READY', '当前没有可保存的已生成回答。', id)
  const snapshot = snapshotFromUnknown(existing.result_json)
  if (!snapshot) return error(500, 'ASK_RESULT_INVALID', '保存的回答格式无效。', id)
  try {
    const saved = await saveAskResult(user.id, params.requestId)
    if (saved?.state !== 'saved') return error(409, 'ASK_RESULT_NOT_READY', '当前没有可保存的已生成回答。', id)
    return NextResponse.json({ matchedChapter: snapshot.matchedChapter, originalText: getLocalChapter(snapshot.matchedChapter)?.original_text ?? null, interpretation: snapshot.interpretation, followUpQuestion: snapshot.followUpQuestion, sessionId: saved.session_id, meta: { provider: snapshot.provider, degraded: snapshot.degraded, persistence: 'saved' } })
  } catch { return error(500, 'ASK_SAVE_FAILED', '回答仍未保存；可继续复制内容后稍后重试。', id) }
}
function error(status: number, code: string, message: string, requestId: string) { return NextResponse.json({ error: { code, message }, requestId }, { status }) }
