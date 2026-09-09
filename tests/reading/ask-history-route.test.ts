import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { eqMock, maybeSingleMock } = vi.hoisted(() => ({ eqMock: vi.fn(), maybeSingleMock: vi.fn() }))

vi.mock('@/lib/journal/ask-requests', async () => import('../../src/lib/journal/ask-requests'))
vi.mock('@/lib/chapters', () => ({ getLocalChapter: () => ({ original_text: '上善若水。' }) }))
vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: true,
  createClient: () => {
    const query = { select: vi.fn(), eq: eqMock, maybeSingle: maybeSingleMock }
    query.select.mockReturnValue(query); eqMock.mockReturnValue(query)
    return {
      auth: { getUser: async () => ({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: vi.fn(() => query),
    }
  },
}))

import { GET } from '../../src/app/api/ask/[sessionId]/route'

const OWNER_ID = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'
const SESSION_ID = '753e0f9c-0d47-4c98-9667-f9466d16ec0b'

describe('owned ask history route', () => {
  beforeEach(() => { eqMock.mockClear(); maybeSingleMock.mockReset() })

  it('reads one saved session with an explicit current-user predicate', async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: SESSION_ID, question: '何以自处？', matched_chapter_id: 8, ai_response: '像水一样。', follow_up_question: '能否留白？', ai_provider: 'agnes', degraded: false, fallback_reason: null, source_entry_id: '69b4a169-8b2a-4744-8cec-c705d50f75dc', volume_id: null, created_at: '2026-09-10T00:00:00Z' }, error: null })
    const response = await GET(new NextRequest(`http://localhost/api/ask/${SESSION_ID}`), { params: { sessionId: SESSION_ID } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(eqMock).toHaveBeenCalledWith('id', SESSION_ID)
    expect(eqMock).toHaveBeenCalledWith('user_id', OWNER_ID)
    expect(body.session).toMatchObject({ id: SESSION_ID, question: '何以自处？', matchedChapter: 8, originalText: '上善若水。', sourceEntryId: '69b4a169-8b2a-4744-8cec-c705d50f75dc', volumeId: null })
  })

  it('returns 404 for a missing or foreign session without exposing details', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    const response = await GET(new NextRequest(`http://localhost/api/ask/${SESSION_ID}`), { params: { sessionId: SESSION_ID } })
    expect(response.status).toBe(404)
    expect((await response.json()).error.code).toBe('ASK_SESSION_NOT_FOUND')
  })
})
