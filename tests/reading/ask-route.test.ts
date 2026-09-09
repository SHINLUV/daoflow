import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { askDaoMock, claimMock, configured } = vi.hoisted(() => ({ askDaoMock: vi.fn(), claimMock: vi.fn(), configured: { value: true } }))

vi.mock('@/lib/ai/askDao', () => ({ askDao: askDaoMock }))
vi.mock('@/lib/chapters', () => ({ getLocalChapter: () => ({ original_text: '上善若水。' }) }))
vi.mock('@/lib/journal/ask-requests', async () => import('../../src/lib/journal/ask-requests'))
vi.mock('@/lib/supabase/server', () => ({
  get isSupabaseConfigured() { return configured.value },
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7' } },
        error: null,
      }),
    },
  }),
}))
vi.mock('@/app/api/journal/ask-requests/server', () => ({
  hasAskServiceConfiguration: () => true,
  claimAskRequest: claimMock,
  completeAskRequest: vi.fn(),
  saveAskResult: vi.fn(),
}))

import { POST } from '../../src/app/api/ask/route'

const snapshot = { matchedChapter: 8, interpretation: '上善若水。', followUpQuestion: '你能留出什么空间？', provider: 'agnes', degraded: false, fallbackReason: null }

describe('ask route claim boundary', () => {
  beforeEach(() => { askDaoMock.mockReset(); claimMock.mockReset(); configured.value = true })

  it('assigns and echoes a server request id for an old authenticated {question} client', async () => {
    claimMock.mockImplementation(async (_userId: string, input: { requestId: string }) => ({ request_id: input.requestId, state: 'saved', result_json: snapshot, session_id: '753e0f9c-0d47-4c98-9667-f9466d16ec0b', claim_token: null, generation: 1, lease_until: null, claimed: false }))
    const response = await POST(request({ question: '我该如何处理这段关系？' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(claimMock.mock.calls[0][1].requestId).toBe(body.requestId)
    expect(askDaoMock).not.toHaveBeenCalled()
  })

  it('does not call a model when an owned-link claim has an unknown outcome', async () => {
    claimMock.mockRejectedValue(new Error('connection lost after commit'))
    const response = await POST(request({ question: '问题', requestId: '753e0f9c-0d47-4c98-9667-f9466d16ec0b', sourceEntryId: '69b4a169-8b2a-4744-8cec-c705d50f75dc' }))

    expect(response.status).toBe(503)
    expect(askDaoMock).not.toHaveBeenCalled()
  })

  it('does not call a model for a linked request when ownership infrastructure is unavailable', async () => {
    configured.value = false
    const response = await POST(request({ question: '问题', sourceEntryId: '69b4a169-8b2a-4744-8cec-c705d50f75dc' }))
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe('SOURCE_VALIDATION_UNAVAILABLE')
    expect(askDaoMock).not.toHaveBeenCalled()
  })
})

function request(body: unknown) {
  return new NextRequest('http://127.0.0.1/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}
