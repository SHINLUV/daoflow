import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { isAskRequestId, snapshotFromUnknown } from '@/lib/journal/ask-requests'

export async function GET(_request: NextRequest, { params }: { params: { requestId: string } }) {
  const id = crypto.randomUUID()
  if (!isAskRequestId(params.requestId)) return error(400, 'INVALID_REQUEST_ID', 'requestId 必须是 UUID。', id)
  const context = await currentUser(id)
  if (context instanceof NextResponse) return context
  const { data, error: readError } = await context.from('journal_ask_requests').select('request_id,state,result_json,session_id,lease_until').eq('request_id', params.requestId).maybeSingle()
  if (readError) return error(500, 'ASK_REQUEST_READ_FAILED', '暂时无法读取问道保存状态。', id)
  if (!data) return error(404, 'ASK_REQUEST_NOT_FOUND', '未找到该问道请求。', id)
  return NextResponse.json({ requestId: data.request_id, state: data.state, result: snapshotFromUnknown(data.result_json), sessionId: data.session_id, leaseUntil: data.lease_until })
}

async function currentUser(id: string) {
  if (!isSupabaseConfigured) return error(503, 'SUPABASE_UNAVAILABLE', '问道保存服务尚未配置。', id)
  const supabase = createClient(); const { data: { user }, error: authError } = await supabase.auth.getUser()
  return authError || !user ? error(401, 'AUTH_REQUIRED', '请先登录后查看问道保存状态。', id) : supabase
}
function error(status: number, code: string, message: string, requestId: string) { return NextResponse.json({ error: { code, message }, requestId }, { status }) }
