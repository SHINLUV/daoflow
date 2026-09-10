import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { isAskRequestId } from '@/lib/journal/ask-requests'
import { verifyMutationRequest } from '@/lib/auth/http'
import { storedAnswerSnapshot, type AskAnswerResponse } from '@/lib/ask-worker/answerResponse'
import { AskRequestRpcError, hasAskServiceConfiguration, retrySaveAskWorkerResult } from '../../server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { requestId: string } }) {
  const id = crypto.randomUUID()
  const security = verifyMutationRequest(request)
  if (!security.ok) return error(403, security.code, security.message, id)
  if (!isAskRequestId(params.requestId)) return error(400, 'INVALID_REQUEST_ID', 'requestId 必须是 UUID。', id)
  if (!isSupabaseConfigured || !hasAskServiceConfiguration()) return error(503, 'ASK_SAVE_UNAVAILABLE', '问道保存服务尚未配置。', id)
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return error(401, 'AUTH_REQUIRED', '请先登录后重试保存。', id)
  try {
    const saved = await retrySaveAskWorkerResult(user.id, params.requestId)
    if (saved?.state !== 'saved') return error(409, 'ASK_RESULT_NOT_READY', '当前没有可保存的已生成回答。', id)
    const { data, error: readError } = await supabase.from('journal_ask_requests')
      .select('request_id,result_json,session_id').eq('request_id', params.requestId).eq('user_id', user.id).maybeSingle()
    if (readError || !data) return error(500, 'ASK_REQUEST_READ_FAILED', '回答已保存，但暂时无法读取展示内容。', id)
    const snapshot = storedAnswerSnapshot(data.result_json)
    if (!snapshot || !data.session_id) return error(500, 'ASK_RESULT_INVALID', '保存的回答格式无效。', id)
    const body: AskAnswerResponse = {
      requestId: data.request_id, answerV2: snapshot.answerV2, provider: snapshot.provider,
      persistence: 'saved', sessionId: data.session_id, retrySaveAvailable: false,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ''
    const code = cause instanceof AskRequestRpcError ? cause.code : undefined
    if (/ASK_REQUEST_NOT_FOUND/.test(message) || code === 'P0002') return error(404, 'ASK_REQUEST_NOT_FOUND', '未找到该问道请求。', id)
    if (/ASK_RESULT_NOT_READY/.test(message) || code === 'P0001') return error(409, 'ASK_RESULT_NOT_READY', '当前没有可保存的已生成回答。', id)
    return error(500, 'ASK_SAVE_FAILED', '回答仍未保存；可继续复制内容后稍后重试。', id)
  }
}

function error(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ error: { code, message }, requestId }, { status, headers: { 'Cache-Control': 'no-store' } })
}
