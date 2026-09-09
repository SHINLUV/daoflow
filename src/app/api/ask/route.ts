import { NextRequest, NextResponse } from 'next/server'
import { askDao } from '@/lib/ai/askDao'
import { getLocalChapter } from '@/lib/chapters'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { AskInputError, parseAskInput, snapshotFromUnknown, toSnapshot } from '@/lib/journal/ask-requests'
import { claimAskRequest, completeAskRequest, hasAskServiceConfiguration, saveAskResult } from '@/app/api/journal/ask-requests/server'

function error(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ error: { code, message }, requestId }, { status })
}

function fromSnapshot(
  snapshot: ReturnType<typeof snapshotFromUnknown>,
  sessionId: string | null,
  persistence: 'saved' | 'failed' | 'not_requested',
  requestId: string | null,
  message?: string,
  retrySaveAvailable = false,
) {
  if (!snapshot) return null
  return NextResponse.json({
    requestId,
    matchedChapter: snapshot.matchedChapter,
    originalText: getLocalChapter(snapshot.matchedChapter)?.original_text ?? null,
    interpretation: snapshot.interpretation,
    followUpQuestion: snapshot.followUpQuestion,
    sessionId: persistence === 'saved' ? sessionId : null,
    meta: {
      provider: snapshot.provider,
      degraded: snapshot.degraded,
      fallbackReason: snapshot.fallbackReason,
      persistence,
      retrySaveAvailable,
      ...(message ? { persistenceMessage: message } : {}),
    },
  })
}

export async function POST(request: NextRequest) {
  const id = crypto.randomUUID()
  let input
  try { input = parseAskInput(await request.json()) } catch (cause) { return error(400, 'INVALID_ASK', cause instanceof AskInputError ? cause.message : '请求体必须是合法 JSON。', id) }
  const hasOwnedLink = Boolean(input.sourceEntryId || input.volumeId)
  if (!isSupabaseConfigured) {
    if (hasOwnedLink) return error(503, 'SOURCE_VALIDATION_UNAVAILABLE', '暂时无法确认来源记录的所有权；未调用模型。', input.requestId ?? id)
    return answerWithoutPersistence(input.question, input.requestId, 'not_requested', '未配置登录与保存服务，本次回答不会进入历史。')
  }

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    if (hasOwnedLink) return error(401, 'AUTH_REQUIRED', '请先登录后确认来源记录；未调用模型。', input.requestId ?? id)
    return answerWithoutPersistence(input.question, input.requestId, 'not_requested')
  }
  if (!hasAskServiceConfiguration()) {
    const linkError = await validateOwnedLinks(supabase, user.id, input.sourceEntryId, input.volumeId, id)
    if (linkError) return linkError
    return answerWithoutPersistence(input.question, input.requestId, 'failed', '保存服务尚未配置；回答可复制，但未保存到历史。')
  }

  const persistenceRequestId = input.requestId ?? crypto.randomUUID()
  let claimed
  try {
    claimed = await claimAskRequest(user.id, { ...input, requestId: persistenceRequestId })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ''
    if (message.includes('SOURCE_NOT_FOUND') || message.includes('VOLUME_NOT_FOUND')) return error(404, 'NOT_FOUND', '来源记录或卷册不存在，或你没有权限访问。', persistenceRequestId)
    if (message.includes('IDEMPOTENCY_CONFLICT')) return error(409, 'IDEMPOTENCY_CONFLICT', '该 requestId 已用于不同的问题或关联。', persistenceRequestId)
    // A lost RPC response may mean the claim committed. Never call a model until
    // ownership of the current claim is positively established.
    return error(503, 'ASK_CLAIM_UNCERTAIN', '暂时无法确认问道请求状态；请使用同一 requestId 重试。', persistenceRequestId)
  }
  if (!claimed) return error(503, 'ASK_CLAIM_UNAVAILABLE', '暂时无法建立可保存的问道请求。', persistenceRequestId)

  const previous = snapshotFromUnknown(claimed.result_json)
  if (claimed.state === 'saved') return fromSnapshot(previous, claimed.session_id, 'saved', claimed.request_id) ?? error(500, 'ASK_RESULT_INVALID', '已保存的回答无法读取。', persistenceRequestId)
  if (claimed.state === 'generated') return previous ? persistGenerated(user.id, claimed.request_id, previous) : error(500, 'ASK_RESULT_INVALID', '已生成的回答无法读取。', persistenceRequestId)
  if (!claimed.claimed) return NextResponse.json({ state: claimed.state, requestId: persistenceRequestId }, { status: 202, headers: { 'Retry-After': '3' } })

  const generated = await askDao(input.question)
  const generatedSnapshot = toSnapshot(generated)
  let completed
  try { completed = await completeAskRequest(user.id, claimed, generatedSnapshot) } catch {
    return fromSnapshot(generatedSnapshot, null, 'failed', persistenceRequestId, '回答已生成，但结果暂存失败；请先复制内容，稍后可重新提问。')!
  }
  const completedSnapshot = snapshotFromUnknown(completed?.result_json)
  if (completed?.state === 'saved') return fromSnapshot(completedSnapshot, completed.session_id, 'saved', persistenceRequestId) ?? error(500, 'ASK_RESULT_INVALID', '已保存的回答无法读取。', persistenceRequestId)
  if (completed?.state !== 'generated') return NextResponse.json({ state: completed?.state ?? 'processing', requestId: persistenceRequestId }, { status: 202, headers: { 'Retry-After': '3' } })
  return persistGenerated(user.id, persistenceRequestId, completedSnapshot ?? generatedSnapshot)
}

async function validateOwnedLinks(supabase: ReturnType<typeof createClient>, userId: string, sourceEntryId: string | null, volumeId: string | null, id: string) {
  if (sourceEntryId) {
    const { data, error: readError } = await supabase.from('journal_entries').select('id,body,deleted_at').eq('id', sourceEntryId).eq('user_id', userId).maybeSingle()
    if (readError) return error(500, 'SOURCE_READ_FAILED', '暂时无法读取来源记录。', id)
    if (!data || data.deleted_at) return error(404, 'SOURCE_NOT_FOUND', '来源记录不存在，或你没有权限访问。', id)
  }
  if (volumeId) {
    const { data, error: readError } = await supabase.from('journal_volumes').select('id,archived_at').eq('id', volumeId).eq('user_id', userId).maybeSingle()
    if (readError) return error(500, 'VOLUME_READ_FAILED', '暂时无法读取卷册。', id)
    if (!data || data.archived_at) return error(404, 'VOLUME_NOT_FOUND', '卷册不存在、已归档，或你没有权限访问。', id)
  }
  return null
}

async function persistGenerated(userId: string, requestId: string, snapshot: NonNullable<ReturnType<typeof snapshotFromUnknown>>) {
  try {
    const saved = await saveAskResult(userId, requestId)
    if (saved?.state === 'saved') return fromSnapshot(snapshot, saved.session_id, 'saved', requestId)!
  } catch { /* The generated result remains server-side; do not pretend it was saved. */ }
  return fromSnapshot(snapshot, null, 'failed', requestId, '回答已生成，但尚未保存到历史；可复制后稍后重试保存。', true)!
}

async function answerWithoutPersistence(question: string, requestId: string | null, persistence: 'failed' | 'not_requested', message?: string) {
  return fromSnapshot(toSnapshot(await askDao(question)), null, persistence, requestId, message)!
}
