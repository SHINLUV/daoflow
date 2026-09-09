import { describe, expect, it } from 'vitest'
import {
  EntryInputError,
  InputRevision,
  PrivateDataEpoch,
  makeEntryCursor,
  mapEntry,
  parseCreateEntry,
  parseEntryId,
  parseEntryCursor,
  parsePatchEntry,
  sameCreatePayload,
} from '../../src/lib/journal/entries'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// These tests are deliberately database-free.  They verify the exact input and
// idempotency contract that the authenticated RPC/API must consume.  The real
// two-user/RLS cases below require an isolated local Supabase Auth project and
// are not represented as mocked database success.
const entryId = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'
const volumeId = '53a1ab7a-0f42-4b53-8bf1-57036f97d8aa'

describe('journal entry protocol (database-free)', () => {
  it('normalizes a valid create request without accepting authority fields', () => {
    const input = parseCreateEntry({ id: entryId, body: '  今天和同事聊了工作安排  ', title: '  工作  ', mood: 'uneasy', volumeId, user_id: 'must-not-be-used' })
    expect(input).toEqual({ id: entryId, body: '今天和同事聊了工作安排', title: '工作', mood: 'uneasy', volumeId })
  })

  it('rejects blank content, illegal moods, and mixed recycle edits', () => {
    expect(() => parseCreateEntry({ id: entryId, body: '   ' })).toThrow(EntryInputError)
    expect(() => parseCreateEntry({ id: entryId, body: '正文', mood: 'guessed' })).toThrow(EntryInputError)
    expect(() => parsePatchEntry({ version: 1, deleted: true, body: '不能同时改' })).toThrow(EntryInputError)
  })

  it('keeps same-ID retries idempotent but detects different payloads', () => {
    const payload = parseCreateEntry({ id: entryId, body: '今天和同事聊了工作安排', title: '工作', mood: 'uneasy', volumeId })
    const stored = mapEntry({ id: entryId, body: payload.body, title: payload.title, mood: payload.mood, volume_id: payload.volumeId, version: 1, created_at: '2026-09-09T01:00:00.000Z', updated_at: '2026-09-09T01:00:00.000Z', deleted_at: null })
    expect(sameCreatePayload(stored, payload)).toBe(true)
    expect(sameCreatePayload(stored, { ...payload, body: '相同 ID 的另一段内容' })).toBe(false)
  })

  it('uses a stable createdAt/id cursor and rejects forged cursors', () => {
    const entry = mapEntry({ id: entryId, body: '正文', title: null, mood: null, volume_id: null, version: 1, created_at: '2026-09-09T01:00:00.000Z', updated_at: '2026-09-09T01:00:00.000Z', deleted_at: null })
    expect(parseEntryCursor(makeEntryCursor(entry))).toEqual({ createdAt: entry.createdAt, id: entry.id })
    expect(() => parseEntryCursor('not-a-cursor')).toThrow(EntryInputError)
  })

  it('rejects invalid route UUIDs before a handler can reach Postgres', () => {
    expect(parseEntryId(entryId)).toBe(entryId)
    expect(() => parseEntryId('not-a-uuid')).toThrow(EntryInputError)
    expect(() => parseEntryId('00000000-0000-0000-0000-000000000000')).toThrow(EntryInputError)
  })

  it('has an atomic create-entry conflict path rather than exposing a primary-key race', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/003_journal.sql'), 'utf8')
    expect(migration).toMatch(/insert into public\.journal_entries[\s\S]*?on conflict \(id\) do nothing[\s\S]*?returning \* into v_entry/i)
    expect(migration).toMatch(/select \* into v_entry from public\.journal_entries where id = p_id;[\s\S]*?v_entry\.user_id <> v_user_id/i)
  })

  it('distinguishes a stale purge version from an unrecycled entry', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/008_journal_runtime_repairs.sql'), 'utf8')
    expect(migration).toMatch(/create or replace function public\.purge_entry[\s\S]*?p_version <> v_entry\.version[\s\S]*?CAS_CONFLICT[\s\S]*?v_entry\.deleted_at is null[\s\S]*?PURGE_REQUIRES_RECYCLED_ENTRY/i)
  })

  it('rejects a delayed private response after the authenticated owner changes', async () => {
    const guard = new PrivateDataEpoch()
    guard.acceptOwner('user-a')
    const token = guard.capture()
    let release!: () => void
    const delayed = new Promise<void>(resolve => { release = resolve })
    let applied = false
    const response = delayed.then(() => { if (guard.isCurrent(token)) applied = true })
    guard.acceptOwner('user-b')
    release()
    await response
    expect(applied).toBe(false)
    expect(guard.isCurrent(token)).toBe(false)
    expect(guard.capture().ownerId).toBe('user-b')
  })

  it('wires every private journal surface through auth events, abort signals, and owner tokens', () => {
    for (const file of ['JournalEditor.tsx', 'JournalLibrary.tsx', 'VolumeDetail.tsx']) {
      const source = readFileSync(resolve(process.cwd(), 'src/components/v2/journal', file), 'utf8')
      expect(source).toMatch(/onAuthStateChange/)
      expect(source).toMatch(/signal:\s*request\.controller\.signal/)
      expect(source).toMatch(/privateEpoch\.current\.isCurrent\(request\.token\)/)
    }
  })

  it('does not let a slow mutation clear text typed after submission', async () => {
    const revision = new InputRevision()
    let input = '提交时文字'
    const submittedAt = revision.capture()
    let release!: () => void
    const delayed = new Promise<void>(resolve => { release = resolve }).then(() => {
      if (revision.isCurrent(submittedAt)) input = ''
    })
    input = '请求期间继续输入的文字'
    revision.bump()
    release()
    await delayed
    expect(input).toBe('请求期间继续输入的文字')
  })

  it('invalidates a failed retry payload when its input revision changed', () => {
    const revision = new InputRevision()
    const submittedAt = revision.capture()
    revision.bump()
    const retryPayload = revision.isCurrent(submittedAt) ? { title: '旧标题' } : null
    expect(retryPayload).toBeNull()
  })
})

const liveLocal = process.env.DAOFLOW_LIVE_LOCAL === '1'
const liveBaseUrl = process.env.DAOFLOW_LIVE_BASE_URL || 'http://127.0.0.1:3200'
function liveCookie(owner: 'A' | 'B') {
  const cookie = process.env[`DAOFLOW_LIVE_COOKIE_${owner}`]
  if (!cookie) throw new Error(`DAOFLOW_LIVE_COOKIE_${owner} is required when DAOFLOW_LIVE_LOCAL=1`)
  return cookie
}
async function liveApi(owner: 'A' | 'B', path: string, init: RequestInit = {}) {
  return fetch(`${liveBaseUrl}${path}`, { ...init, headers: { cookie: liveCookie(owner), 'content-type': 'application/json', ...init.headers } })
}

describe.runIf(liveLocal)('journal entries with real authenticated local Supabase', () => {
  it('A creates an entry and B receives 404 from GET /api/journal/entries/:id', async () => {
    const id = crypto.randomUUID()
    const created = await liveApi('A', '/api/journal/entries', { method: 'POST', body: JSON.stringify({ id, body: 'LIVE_LOCAL_A_OWNER_ISOLATION' }) })
    expect(created.status).toBe(201)
    expect((await liveApi('B', `/api/journal/entries/${id}`)).status).toBe(404)
  })
  it('returns one row for simultaneous same-ID same-payload retries, 409 for different payload, and only purges recycled entries', async () => {
    const id = crypto.randomUUID()
    const body = JSON.stringify({ id, body: 'LIVE_LOCAL_IDEMPOTENCY' })
    const [first, second] = await Promise.all([liveApi('A', '/api/journal/entries', { method: 'POST', body }), liveApi('A', '/api/journal/entries', { method: 'POST', body })])
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect((await liveApi('A', '/api/journal/entries', { method: 'POST', body: JSON.stringify({ id, body: 'DIFFERENT' }) })).status).toBe(409)
    const entry = (await first.json()).entry as { version: number }
    expect((await liveApi('A', `/api/journal/entries/${id}`, { method: 'DELETE', body: JSON.stringify({ version: entry.version }) })).status).toBe(409)
    const recycled = await liveApi('A', `/api/journal/entries/${id}`, { method: 'PATCH', body: JSON.stringify({ version: entry.version, deleted: true }) })
    expect(recycled.status).toBe(200)
    const recycledEntry = (await recycled.json()).entry as { version: number }
    const stalePurge = await liveApi('A', `/api/journal/entries/${id}`, { method: 'DELETE', body: JSON.stringify({ version: entry.version }) })
    expect(stalePurge.status).toBe(409)
    expect((await stalePurge.json()).error.code).toBe('VERSION_CONFLICT')
    expect((await liveApi('A', `/api/journal/entries/${id}`, { method: 'DELETE', body: JSON.stringify({ version: recycledEntry.version }) })).status).toBe(200)
  })
})
