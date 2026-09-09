import { describe, expect, it } from 'vitest'
import { getLocalChapter } from '../../src/lib/chapters'
import { AskInputError, parseAskInput, snapshotFromUnknown } from '../../src/lib/journal/ask-requests'

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
})

// Requires an isolated local Supabase project migrated 001→002→003→004→005,
// two browser-authenticated users and a controllable model fixture. No mock proves RLS.
describe.skip('ask persistence with real Auth/RLS/RPC [BLOCKED: local Supabase unavailable]', () => {
  it('rejects another user source or volume with 404 before model invocation', async () => {})
  it('returns 202 for same requestId in flight, 409 for changed payload, and accepts only current claim token completion', async () => {})
  it('keeps generated result server-side and retry-save writes exactly one ask_sessions row without a new model call', async () => {})
  it('rejects authenticated direct DML and service-only RPC from a browser user', async () => {})
})
