import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { getLocalChapter } from '../../src/lib/chapters'
import {
  AskInputError,
  createAskAttempt,
  fallbackNotice,
  isOwnerEpochCurrent,
  nextOwnerEpoch,
  parseAskInput,
  readEntryAskHandoff,
  readAskAttempt,
  sameAskPayload,
  snapshotFromUnknown,
} from '../../src/lib/journal/ask-requests'

describe('ask request protocol (database-free)', () => {
  it('accepts only a short explicitly-authored question and UUID links', () => {
    const entryId = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'
    const parsed = parseAskInput({ question: '  我应如何处理这段关系？ ', requestId: entryId, sourceEntryId: entryId, volumeId: null })
    expect(parsed.question).toBe('我应如何处理这段关系？')
    expect(() => parseAskInput({ question: 'x'.repeat(501) })).toThrow(AskInputError)
    expect(() => parseAskInput({ question: '问题', sourceEntryId: 'not-a-uuid' })).toThrow(AskInputError)
  })

  it('accepts only complete server-generated result snapshots', () => {
    const chapter = getLocalChapter(8)!
    expect(snapshotFromUnknown({ matchedChapter: 8, interpretation: chapter.preset_interpretation, followUpQuestion: null, provider: 'local_fallback', degraded: true, fallbackReason: 'timeout' })?.matchedChapter).toBe(8)
    expect(snapshotFromUnknown({ matchedChapter: 82, interpretation: '伪造', provider: 'x', degraded: false, followUpQuestion: null, fallbackReason: null })).toBeNull()
  })

  it('restores an unfinished request only for the same authenticated owner and payload', () => {
    const ownerA = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'
    const ownerB = '69b4a169-8b2a-4744-8cec-c705d50f75dc'
    const requestId = '753e0f9c-0d47-4c98-9667-f9466d16ec0b'
    const payload = { question: '我应如何看待这次选择？', sourceEntryId: null, volumeId: null }
    const attempt = createAskAttempt(ownerA, requestId, payload, 1_000)
    const serialized = JSON.stringify(attempt)

    expect(readAskAttempt(serialized, ownerA, 2_000)).toEqual(attempt)
    expect(readAskAttempt(serialized, ownerB, 2_000)).toBeNull()
    expect(sameAskPayload(attempt, payload)).toBe(true)
    expect(sameAskPayload(attempt, { ...payload, question: '我换了一个问题' })).toBe(false)
  })

  it('rejects stale or malformed persisted request state', () => {
    const owner = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'
    const requestId = '753e0f9c-0d47-4c98-9667-f9466d16ec0b'
    const attempt = createAskAttempt(owner, requestId, { question: '问题', sourceEntryId: null, volumeId: null }, 1_000)

    expect(readAskAttempt(JSON.stringify(attempt), owner, 1_000 + 31 * 60_000)).toBeNull()
    expect(readAskAttempt('{broken', owner, 2_000)).toBeNull()
  })

  it('does not reveal an entry handoff until its real owner is confirmed', () => {
    const ownerA = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'
    const ownerB = '69b4a169-8b2a-4744-8cec-c705d50f75dc'
    const entryId = '753e0f9c-0d47-4c98-9667-f9466d16ec0b'
    const serialized = JSON.stringify({ question: '只属于A的心笺', sourceEntryId: entryId, volumeId: null, ownerId: ownerA })

    expect(readEntryAskHandoff(serialized, ownerA)?.question).toBe('只属于A的心笺')
    expect(readEntryAskHandoff(serialized, ownerB)).toBeNull()
    expect(readEntryAskHandoff(serialized, null)).toBeNull()
  })

  it('describes every non-Agnes provider as a fallback', () => {
    expect(fallbackNotice('agnes', false, null)).toBeNull()
    expect(fallbackNotice('deepseek', false, null)).toMatch(/DeepSeek/)
    expect(fallbackNotice('local_fallback', true, 'timeout')).toMatch(/本地.*超时/)
  })

  it('drops a delayed response after the authenticated owner changes', async () => {
    const ownerA = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'
    const ownerB = '69b4a169-8b2a-4744-8cec-c705d50f75dc'
    let current = nextOwnerEpoch({ ownerId: null, epoch: 0 }, ownerA)
    const captured = current
    let visible = ''
    const delayed = Promise.resolve('不应显示的A账户结果')

    current = nextOwnerEpoch(current, ownerB)
    const value = await delayed
    if (isOwnerEpochCurrent(current, captured)) visible = value

    expect(visible).toBe('')
  })
})

// Opt-in, fixture-backed proof against a running isolated local stack. The flag
// alone is insufficient: missing fixture IDs/tokens fail loudly rather than
// allowing a mock or an empty skipped body to masquerade as live proof.
const live = process.env.DAOFLOW_LIVE_LOCAL_ASK === '1'
describe.skipIf(!live)('ask persistence with real Auth/RLS/RPC [LIVE LOCAL]', () => {
  it('rejects another user source with 404 without incrementing the model fixture counter', async () => {
    const baseUrl = requiredEnv('DAOFLOW_LIVE_APP_URL')
    const cookieA = requiredEnv('DAOFLOW_LIVE_COOKIE_A')
    const foreignSourceId = requiredEnv('DAOFLOW_LIVE_FOREIGN_SOURCE_ID')
    const counterUrl = requiredEnv('DAOFLOW_LIVE_MODEL_COUNTER_URL')
    const before = await readInvocationCount(counterUrl)
    const response = await fetch(`${baseUrl}/api/ask`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieA },
      body: JSON.stringify({ question: '跨账户来源必须被拒绝', requestId: crypto.randomUUID(), sourceEntryId: foreignSourceId }),
    })
    expect(response.status).toBe(404)
    expect(await readInvocationCount(counterUrl)).toBe(before)
  })

  it('returns an in-flight replay and rejects a conflicting payload for one request id', async () => {
    const baseUrl = requiredEnv('DAOFLOW_LIVE_APP_URL')
    const cookieA = requiredEnv('DAOFLOW_LIVE_COOKIE_A')
    const requestId = crypto.randomUUID()
    const post = (question: string) => fetch(`${baseUrl}/api/ask`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieA }, body: JSON.stringify({ question, requestId }),
    })
    const first = post('同一个问题只应生成一次')
    const [replay, conflict, initial] = await Promise.all([post('同一个问题只应生成一次'), post('冲突问题'), first])
    expect([initial.status, replay.status]).toContain(202)
    expect(conflict.status).toBe(409)
  })

  it('retry-save is idempotent and does not increment the model fixture counter', async () => {
    const baseUrl = requiredEnv('DAOFLOW_LIVE_APP_URL')
    const cookieA = requiredEnv('DAOFLOW_LIVE_COOKIE_A')
    const generatedRequestId = requiredEnv('DAOFLOW_LIVE_GENERATED_REQUEST_ID')
    const counterUrl = requiredEnv('DAOFLOW_LIVE_MODEL_COUNTER_URL')
    const before = await readInvocationCount(counterUrl)
    const save = () => fetch(`${baseUrl}/api/journal/ask-requests/${generatedRequestId}/retry-save`, { method: 'POST', headers: { cookie: cookieA } })
    const first = await save(); const firstBody = await first.json()
    const second = await save(); const secondBody = await second.json()
    expect(first.status).toBe(200); expect(second.status).toBe(200)
    expect(secondBody.sessionId).toBe(firstBody.sessionId)
    expect(await readInvocationCount(counterUrl)).toBe(before)
  })

  it('rejects authenticated direct DML and service-only claim RPC from a browser user', async () => {
    const supabaseUrl = requiredEnv('DAOFLOW_LIVE_SUPABASE_URL')
    const anonKey = requiredEnv('DAOFLOW_LIVE_SUPABASE_ANON_KEY')
    const accessToken = requiredEnv('DAOFLOW_LIVE_ACCESS_TOKEN_A')
    const ownerA = requiredEnv('DAOFLOW_LIVE_USER_A_ID')
    const client = createSupabaseClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    const direct = await client.from('ask_sessions').insert({ user_id: ownerA, question: '不允许直写', matched_chapter_id: 1, ai_response: 'x', ai_provider: 'x' })
    const requestId = crypto.randomUUID()
    const claim = await client.rpc('claim_ask_request', { p_user_id: ownerA, p_request_id: requestId, p_question: '不允许调用', p_source_entry_id: null, p_volume_id: null })
    const complete = await client.rpc('complete_ask_request', {
      p_user_id: ownerA,
      p_request_id: requestId,
      p_claim_token: crypto.randomUUID(),
      p_generation: 1,
      p_result: { matchedChapter: 1, interpretation: '不应写入', followUpQuestion: null, provider: 'fixture', degraded: false, fallbackReason: null },
    })
    const save = await client.rpc('save_ask_result', { p_user_id: ownerA, p_request_id: requestId })
    expect(direct.error).toBeTruthy()
    for (const result of [claim, complete, save]) {
      expect(result.error).toBeTruthy()
      expect(result.error?.code).not.toBe('42883')
      expect(result.error?.code).not.toBe('PGRST202')
      expect(result.error?.message.toLowerCase()).toMatch(/permission|权限/)
    }
  })
})

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required when DAOFLOW_LIVE_LOCAL_ASK=1`)
  return value
}

async function readInvocationCount(url: string): Promise<number> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('model counter fixture is unavailable')
  const body = await response.json() as { count?: unknown }
  if (typeof body.count !== 'number') throw new Error('model counter fixture returned an invalid count')
  return body.count
}
