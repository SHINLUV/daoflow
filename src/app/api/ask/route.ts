import { NextRequest, NextResponse } from 'next/server'
import { askDao } from '@/lib/ai/askDao'
import { getLocalChapter } from '@/lib/chapters'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { AskInputError, claimAskRequest, completeAskRequest, hasAskServiceConfiguration, parseAskInput, saveAskResult, snapshotFromUnknown, toSnapshot } from '@/lib/journal/ask-requests'

function error(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ error: { code, message }, requestId }, { status })
}

function fromSnapshot(snapshot: ReturnType<typeof snapshotFromUnknown>, sessionId: string | null, persistence: 'saved' | 'failed' | 'not_requested', message?: string) {
  if (!snapshot) return null
  return NextResponse.json({ matchedChapter: snapshot.matchedChapter, originalText: getLocalChapter(snapshot.matchedChapter)?.original_text ?? null, interpretation: snapshot.interpretation, followUpQuestion: snapshot.followUpQuestion, sessionId: persistence === 'saved' ? sessionId : null, meta: { provider: snapshot.provider, degraded: snapshot.degraded, persistence, ...(message ? { persistenceMessage: message } : {}) } })
}

export async function POST(request: NextRequest) {
  const id = crypto.randomUUID()
  let input
  try { input = parseAskInput(await request.json()) } catch (cause) { return error(400, 'INVALID_ASK', cause instanceof AskInputError ? cause.message : '请求体必须是合法 JSON。', id) }
  if (!isSupabaseConfigured) return answerWithoutPersistence(input.question, 'not_requested', '未配置登录与保存服务，本次回答不会进入历史。')

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return answerWithoutPersistence(input.question, 'not_requested')
  const linkError = await validateOwnedLinks(supabase, user.id, input.sourceEntryId, input.volumeId, id)
  if (linkError) return linkError
  if (!input.requestId) return error(400, 'REQUEST_ID_REQUIRED', '登录后保存问道需要 requestId。', id)
  if (!hasAskServiceConfiguration()) return answerWithoutPersistence(input.question, 'failed', '保存服务尚未配置；回答可复制，但未保存到历史。')

  try {
    const claimed = await claimAskRequest(user.id, { ...input, requestId: input.requestId })
    if (!claimed) return answerWithoutPersistence(input.question, 'failed', '保存服务尚未配置；回答可复制，但未保存到历史。')
    const previous = snapshotFromUnknown(claimed.result_json)
    if (claimed.state === 'saved') return fromSnapshot(previous, claimed.session_id, 'saved') ?? error(500, 'ASK_RESULT_INVALID', '已保存的回答无法读取。', id)
    if (claimed.state === 'generated') return previous ? persistGenerated(user.id, claimed.request_id, previous, input.question) : error(500, 'ASK_RESULT_INVALID', '已生成的回答无法读取。', id)
    if (!claimed.claimed) return NextResponse.json({ state: 'processing', requestId: input.requestId }, { status: 202, headers: { 'Retry-After': '3' } })
    const generated = await askDao(input.question)
    const generatedSnapshot = toSnapshot(generated)
    let completed
    try { completed = await completeAskRequest(user.id, claimed, generatedSnapshot) } catch {
      return fromSnapshot(generatedSnapshot, null, 'failed', '回答已生成，但结果暂存失败；请先复制内容，稍后可重新提问。')!
    }
    const completedSnapshot = snapshotFromUnknown(completed?.result_json)
    if (completed?.state === 'saved') return fromSnapshot(completedSnapshot, completed.session_id, 'saved') ?? error(500, 'ASK_RESULT_INVALID', '已保存的回答无法读取。', id)
    if (completed?.state !== 'generated') return NextResponse.json({ state: 'processing', requestId: input.requestId }, { status: 202, headers: { 'Retry-After': '3' } })
    return persistGenerated(user.id, input.requestId, completedSnapshot ?? generatedSnapshot, input.question)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ''
    if (message.includes('SOURCE_NOT_FOUND') || message.includes('VOLUME_NOT_FOUND')) return error(404, 'NOT_FOUND', '来源记录或卷册不存在，或你没有权限访问。', id)
    if (message.includes('IDEMPOTENCY_CONFLICT')) return error(409, 'IDEMPOTENCY_CONFLICT', '该 requestId 已用于不同的问题或关联。', id)
    return answerWithoutPersistence(input.question, 'failed', '回答未能可靠保存到历史；你可以复制当前内容后重试。')
  }
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

async function persistGenerated(userId: string, requestId: string, snapshot: NonNullable<ReturnType<typeof snapshotFromUnknown>>, question: string) {
  try {
    const saved = await saveAskResult(userId, requestId)
    if (saved?.state === 'saved') return fromSnapshot(snapshot, saved.session_id, 'saved')!
  } catch { /* The generated result remains server-side; do not pretend it was saved. */ }
  return fromSnapshot(snapshot, null, 'failed', '回答已生成，但尚未保存到历史；可复制后稍后重试保存。') ?? answerWithoutPersistence(question, 'failed', '回答未能保存到历史。')
}

async function answerWithoutPersistence(question: string, persistence: 'failed' | 'not_requested', message?: string) {
  return fromSnapshot(toSnapshot(await askDao(question)), null, persistence, message)!
}
