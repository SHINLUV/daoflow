import { describe, expect, it } from 'vitest'
import { parseExportRange } from '../../src/lib/journal/export'
import { JournalQueryError, mergeTimeline, parseVolumeCreate } from '../../src/lib/journal/volumes'

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
  it('does not accept malformed volume identifiers', () => { expect(() => parseVolumeCreate({ id: 'no', title: '卷' })).toThrow(JournalQueryError) })
})

describe.skip('volume/export with real authenticated Supabase [BLOCKED: isolated Auth/DB fixture required]', () => {
  it('keeps A/B volumes isolated, forbids assigning B volume, and verifies >25 stable pages', async () => {})
  it('exports a repeatable 5MB-bounded snapshot with range references and no B content', async () => {})
})
