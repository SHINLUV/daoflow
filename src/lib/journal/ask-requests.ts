import { createClient as createServiceClient } from '@supabase/supabase-js'

export type AskRequestInput = { question: string; requestId: string | null; sourceEntryId: string | null; volumeId: string | null }
export type AskPersistence = 'saved' | 'failed' | 'not_requested'
export type AskResultSnapshot = { matchedChapter: number; interpretation: string; followUpQuestion: string | null; provider: string; degraded: boolean; fallbackReason: string | null }
export type ClaimedAskRequest = { request_id: string; state: 'processing' | 'generated' | 'saved' | 'failed'; result_json: AskResultSnapshot | null; session_id: string | null; claim_token: string | null; generation: number; lease_until: string | null; claimed: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

export function hasAskServiceConfiguration(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function service() {
  if (!hasAskServiceConfiguration()) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function claimAskRequest(userId: string, input: Required<AskRequestInput>): Promise<ClaimedAskRequest | null> {
  const client = service()
  if (!client) return null
  const { data, error } = await client.rpc('claim_ask_request', { p_user_id: userId, p_request_id: input.requestId, p_question: input.question, p_source_entry_id: input.sourceEntryId, p_volume_id: input.volumeId })
  if (error) throw new Error(error.message)
  return (data?.[0] ?? null) as ClaimedAskRequest | null
}

export async function completeAskRequest(userId: string, claimed: ClaimedAskRequest, result: AskResultSnapshot) {
  const client = service()
  if (!client || !claimed.claim_token) return null
  const { data, error } = await client.rpc('complete_ask_request', { p_user_id: userId, p_request_id: claimed.request_id, p_claim_token: claimed.claim_token, p_generation: claimed.generation, p_result: toSnapshot(result) })
  if (error) throw new Error(error.message)
  return data as { state: string; result_json: AskResultSnapshot | null; session_id: string | null } | null
}

export async function saveAskResult(userId: string, requestId: string) {
  const client = service()
  if (!client) return null
  const { data, error } = await client.rpc('save_ask_result', { p_user_id: userId, p_request_id: requestId })
  if (error) throw new Error(error.message)
  return data as { state: string; result_json: AskResultSnapshot | null; session_id: string | null } | null
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !UUID.test(value)) throw new AskInputError(`${field} 必须是 UUID。`)
  return value
}
