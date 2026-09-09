export type AskRequestInput = { question: string; requestId: string | null; sourceEntryId: string | null; volumeId: string | null }
export type AskPayload = Pick<AskRequestInput, 'question' | 'sourceEntryId' | 'volumeId'>
export type EntryAskHandoff = AskPayload & { ownerId: string; sourceEntryId: string }
export type AskPersistence = 'saved' | 'failed' | 'not_requested'
export type AskResultSnapshot = { matchedChapter: number; interpretation: string; followUpQuestion: string | null; provider: string; degraded: boolean; fallbackReason: string | null }
export type ClaimedAskRequest = { request_id: string; state: 'processing' | 'generated' | 'saved' | 'failed'; result_json: AskResultSnapshot | null; session_id: string | null; claim_token: string | null; generation: number; lease_until: string | null; claimed: boolean }
export type AskAttempt = AskPayload & { ownerId: string; requestId: string; state: 'submitting' | 'processing' | 'save_failed'; updatedAt: number }
export type OwnerEpoch = { ownerId: string | null; epoch: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ASK_ATTEMPT_TTL_MS = 30 * 60_000

export class AskInputError extends Error { constructor(message: string) { super(message); this.name = 'AskInputError' } }

export function parseAskInput(body: unknown): AskRequestInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AskInputError('请求体必须是对象。')
  const input = body as Record<string, unknown>
  if (typeof input.question !== 'string') throw new AskInputError('question 必须是文本。')
  const question = input.question.trim()
  if (question.length < 1 || question.length > 500) throw new AskInputError('question 长度须为 1–500 个字符。')
  return {
    question,
    requestId: optionalUuid(input.requestId, 'requestId'),
    sourceEntryId: optionalUuid(input.sourceEntryId, 'sourceEntryId'),
    volumeId: optionalUuid(input.volumeId, 'volumeId'),
  }
}

export function isAskRequestId(value: string): boolean { return UUID.test(value) }

export function nextOwnerEpoch(current: OwnerEpoch, ownerId: string | null): OwnerEpoch {
  return current.ownerId === ownerId ? current : { ownerId, epoch: current.epoch + 1 }
}

export function isOwnerEpochCurrent(current: OwnerEpoch, captured: OwnerEpoch): boolean {
  return current.ownerId === captured.ownerId && current.epoch === captured.epoch
}

export function createAskAttempt(ownerId: string, requestId: string, payload: AskPayload, now = Date.now()): AskAttempt {
  return { ownerId, requestId, question: payload.question, sourceEntryId: payload.sourceEntryId, volumeId: payload.volumeId, state: 'submitting', updatedAt: now }
}

export function sameAskPayload(attempt: Pick<AskAttempt, keyof AskPayload>, payload: AskPayload): boolean {
  return attempt.question === payload.question
    && attempt.sourceEntryId === payload.sourceEntryId
    && attempt.volumeId === payload.volumeId
}

export function readAskAttempt(value: string | null, ownerId: string, now = Date.now()): AskAttempt | null {
  if (!value || !UUID.test(ownerId)) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const row = parsed as Record<string, unknown>
    if (row.ownerId !== ownerId || typeof row.requestId !== 'string' || !UUID.test(row.requestId)) return null
    if (typeof row.question !== 'string' || row.question.length < 1 || row.question.length > 500) return null
    if (!optionalStoredUuid(row.sourceEntryId) || !optionalStoredUuid(row.volumeId)) return null
    if (row.state !== 'submitting' && row.state !== 'processing' && row.state !== 'save_failed') return null
    if (typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt) || now < row.updatedAt || now - row.updatedAt > ASK_ATTEMPT_TTL_MS) return null
    return row as AskAttempt
  } catch {
    return null
  }
}

export function readEntryAskHandoff(value: string | null, ownerId: string | null): EntryAskHandoff | null {
  if (!value || !ownerId || !UUID.test(ownerId)) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const row = parsed as Record<string, unknown>
    if (row.ownerId !== ownerId || typeof row.sourceEntryId !== 'string' || !UUID.test(row.sourceEntryId)) return null
    if (typeof row.question !== 'string' || row.question.trim().length < 1 || row.question.trim().length > 500) return null
    if (!optionalStoredUuid(row.volumeId)) return null
    return {
      ownerId,
      question: row.question.trim(),
      sourceEntryId: row.sourceEntryId,
      volumeId: row.volumeId as string | null,
    }
  } catch {
    return null
  }
}

export function fallbackNotice(provider: string, degraded: boolean, reason: string | null): string | null {
  if (provider === 'agnes' && !degraded) return null
  if (provider === 'deepseek') return 'Agnes 本次未能回应，已明确切换为备用 DeepSeek。'
  if (provider === 'local_fallback') {
    const reasonText = reason === 'timeout' ? '上游服务超时' : reason === 'rate_limited' ? '上游服务限流' : reason === 'format_error' ? '上游回复格式异常' : '上游服务不可用'
    return `AI 服务本次未能回应，以下是本地经典匹配的降级回应；原因：${reasonText}。`
  }
  return '本次由非 Agnes 备用服务回应。'
}

export function toSnapshot(result: AskResultSnapshot): AskResultSnapshot {
  return { matchedChapter: result.matchedChapter, interpretation: result.interpretation, followUpQuestion: result.followUpQuestion, provider: result.provider, degraded: result.degraded, fallbackReason: result.fallbackReason }
}

export function snapshotFromUnknown(value: unknown): AskResultSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (!Number.isInteger(row.matchedChapter) || (row.matchedChapter as number) < 1 || (row.matchedChapter as number) > 81 || typeof row.interpretation !== 'string' || typeof row.provider !== 'string' || typeof row.degraded !== 'boolean') return null
  if (row.followUpQuestion !== null && typeof row.followUpQuestion !== 'string') return null
  if (row.fallbackReason !== null && typeof row.fallbackReason !== 'string') return null
  return { matchedChapter: row.matchedChapter as number, interpretation: row.interpretation, followUpQuestion: row.followUpQuestion as string | null, provider: row.provider, degraded: row.degraded, fallbackReason: row.fallbackReason as string | null }
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !UUID.test(value)) throw new AskInputError(`${field} 必须是 UUID。`)
  return value
}

function optionalStoredUuid(value: unknown): boolean {
  return value === null || typeof value === 'string' && UUID.test(value)
}
