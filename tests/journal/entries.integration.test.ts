import { describe, expect, it } from 'vitest'
import {
  EntryInputError,
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
})

describe.skip('journal entries with real authenticated Supabase [BLOCKED: local Auth/DB credentials unavailable]', () => {
  it('A creates an entry and B receives 404 from GET /api/journal/entries/:id', async () => {
    // Required fixture: two browser-authenticated HTTP clients against an isolated local project.
    // A POST must return 201; B GET/PATCH/DELETE and RPC association attempts must return 404.
  })
  it('returns one row for simultaneous same-ID same-payload retries, 409 for different payload, and only purges recycled entries', async () => {
    // Required fixture: create -> PATCH with stale version -> same ID replay -> recycle -> restore -> recycle -> purge.
  })
})
