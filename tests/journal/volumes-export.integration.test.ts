import { describe, expect, it } from 'vitest'
import { parseExportRange } from '../../src/lib/journal/export'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JournalQueryError, cursorFilterForType, mergeTimeline, parseCursor, parseVolumeCreate } from '../../src/lib/journal/volumes'

const volumeId = '53a1ab7a-0f42-4b53-8bf1-57036f97d8aa'
const entryId = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'

describe('volume/export protocol (database-free)', () => {
  it('validates a client-generated volume and ISO half-open range', () => {
    expect(parseVolumeCreate({ id: volumeId, title: ' 工作去留 ' })).toEqual({ id: volumeId, title: '工作去留' })
    expect(parseExportRange('2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z')).toEqual({ from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z' })
    expect(() => parseExportRange('2026-09-02T00:00:00.000Z', '2026-09-01T00:00:00.000Z')).toThrow()
  })
  it('merges entry and ask deterministically by createdAt, id, type', () => {
    const page = mergeTimeline([{ id: entryId, title: null, body: '记录', mood: null, volumeId, version: 1, createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z', deletedAt: null }], [{ id: '63a1ab7a-0f42-4b53-8bf1-57036f97d8aa', question: '问道', response: '回应', sourceEntryId: null, volumeId, createdAt: '2026-09-09T00:00:01.000Z' }], 1)
    expect(page.items[0].type).toBe('ask'); expect(page.nextCursor).toBeTruthy()
  })
  it('keeps the other item when entry and ask share the cursor timestamp and UUID', () => {
    const createdAt = '2026-09-09T00:00:00.000Z'
    const cursor = parseCursor(Buffer.from(JSON.stringify({ createdAt, id: entryId, type: 'ask' })).toString('base64url'))
    expect(cursorFilterForType(cursor, 'ask')).not.toContain(`id.eq.${entryId}`)
    expect(cursorFilterForType(cursor, 'entry')).toContain(`id.eq.${entryId}`)
  })
  it('implements concurrent idempotent volume creation in the database function', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/008_journal_runtime_repairs.sql'), 'utf8')
    expect(migration).toMatch(/insert into public\.journal_volumes[\s\S]*?on conflict \(id\) do nothing[\s\S]*?select \* into v_volume from public\.journal_volumes where id = p_id and user_id = v_user_id/i)
    expect(migration.match(/select \* into v_volume from public\.journal_volumes where id = p_id and user_id = v_user_id/gi)).toHaveLength(2)
  })
  it('requires an actual ISO timestamp for export boundaries', () => {
    expect(() => parseExportRange('2026-09-01', null)).toThrow()
    expect(() => parseExportRange('2026-02-30T00:00:00.000Z', null)).toThrow()
  })
  it('uses immutable volume creation time for list pagination', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/journal/volumes/route.ts'), 'utf8')
    expect(route).toMatch(/order\('created_at',[\s\S]*?cursorFor\(last\.createdAt, last\.id\)/)
    expect(route).not.toMatch(/order\('updated_at'/)
  })
  it('does not accept malformed volume identifiers', () => { expect(() => parseVolumeCreate({ id: 'no', title: '卷' })).toThrow(JournalQueryError) })
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

describe.runIf(liveLocal)('volume/export with real authenticated local Supabase', () => {
  it('keeps A/B volumes isolated, forbids assigning B volume, and verifies stable pages over 25 rows', async () => {
    const marker = `LIVE_LOCAL_PAGE_${crypto.randomUUID().slice(0, 8)}`
    const foreignVolumeId = crypto.randomUUID()
    expect((await liveApi('B', '/api/journal/volumes', { method: 'POST', body: JSON.stringify({ id: foreignVolumeId, title: `${marker}_FOREIGN` }) })).status).toBe(201)
    expect((await liveApi('A', '/api/journal/entries', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), body: marker, volumeId: foreignVolumeId }) })).status).toBe(404)
    const ids: string[] = []
    for (let index = 0; index < 26; index += 1) {
      const id = crypto.randomUUID(); ids.push(id)
      expect((await liveApi('A', '/api/journal/volumes', { method: 'POST', body: JSON.stringify({ id, title: `${marker}_${index}` }) })).status).toBe(201)
    }
    const first = await (await liveApi('A', `/api/journal/volumes?q=${marker}&limit=20`)).json()
    const second = await (await liveApi('A', `/api/journal/volumes?q=${marker}&limit=20&cursor=${encodeURIComponent(first.nextCursor)}`)).json()
    const received = [...first.items, ...second.items].map((item: { id: string }) => item.id)
    expect(new Set(received).size).toBe(26)
    expect(ids.every(id => received.includes(id))).toBe(true)
    expect((await liveApi('B', `/api/journal/volumes?q=${marker}`)).status).toBe(200)
    expect((await (await liveApi('B', `/api/journal/volumes?q=${marker}`)).json()).items).toHaveLength(0)
  })
  it('exports only the authenticated owner and preserves the requested range marker', async () => {
    const markerA = `LIVE_EXPORT_A_${crypto.randomUUID()}`
    const markerB = `LIVE_EXPORT_B_${crypto.randomUUID()}`
    await liveApi('A', '/api/journal/entries', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), body: markerA }) })
    await liveApi('B', '/api/journal/entries', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), body: markerB }) })
    const response = await liveApi('A', '/api/journal/export')
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain(markerA)
    expect(text).not.toContain(markerB)
  })
})
