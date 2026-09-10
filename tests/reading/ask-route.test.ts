import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { enqueueMock, generateMock, configured, csrf } = vi.hoisted(() => ({ enqueueMock: vi.fn(), generateMock: vi.fn(), configured: { value: true }, csrf: { ok: true } }))

vi.mock('@/lib/journal/ask-requests', async () => import('../../src/lib/journal/ask-requests'))
vi.mock('@/lib/auth/http', () => ({ verifyMutationRequest: () => csrf.ok ? { ok: true } : { ok: false, code: 'CSRF_REJECTED', message: 'csrf' } }))
vi.mock('@/lib/ai/generateAnswerV2', () => ({ generateDaoAnswerV2: generateMock }))
vi.mock('@/lib/ask-worker/runtime', () => ({ createConfiguredCorpusRepository: vi.fn(), hasAskWorkerRunnerConfiguration: () => true, releaseAnonymousAsk: vi.fn(), reserveAnonymousAsk: vi.fn() }))
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
  enqueueAskWorkerRequest: enqueueMock,
  AskRequestRpcError: class AskRequestRpcError extends Error {},
}))

import { POST } from '../../src/app/api/ask/route'

describe('ask route queue boundary', () => {
  beforeEach(() => { enqueueMock.mockReset(); generateMock.mockReset(); configured.value = true; csrf.ok = true })

  it('assigns and echoes a server request id while only enqueuing an authenticated request', async () => {
    enqueueMock.mockImplementation(async (_userId: string, input: { requestId: string }) => ({ request_id: input.requestId, state: 'pending', lease_until: null }))
    const response = await POST(request({ question: '我该如何处理这段关系？' }))
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(enqueueMock.mock.calls[0][1].requestId).toBe(body.requestId)
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('does not call a model when an owned-link queue outcome is unknown', async () => {
    enqueueMock.mockRejectedValue(new Error('connection lost after commit'))
    const response = await POST(request({ question: '问题', requestId: '753e0f9c-0d47-4c98-9667-f9466d16ec0b', sourceEntryId: '69b4a169-8b2a-4744-8cec-c705d50f75dc' }))

    expect(response.status).toBe(503)
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('maps an owned-link RPC P0002 to a non-disclosing 404 without calling a model', async () => {
    enqueueMock.mockRejectedValue(new Error('SOURCE_NOT_FOUND P0002'))
    const response = await POST(request({ question: '问题', requestId: '753e0f9c-0d47-4c98-9667-f9466d16ec0b', sourceEntryId: '69b4a169-8b2a-4744-8cec-c705d50f75dc' }))

    expect(response.status).toBe(404)
    expect((await response.json()).error.code).toBe('NOT_FOUND')
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('does not call a model for a linked request when ownership infrastructure is unavailable', async () => {
    configured.value = false
    const response = await POST(request({ question: '问题', sourceEntryId: '69b4a169-8b2a-4744-8cec-c705d50f75dc' }))
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe('ASK_AUTH_UNAVAILABLE')
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('rejects a missing CSRF proof before it can queue or generate', async () => {
    csrf.ok = false
    const response = await POST(request({ question: '问题' }))
    expect(response.status).toBe(403)
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
  })
})

function request(body: unknown) { return new NextRequest('http://127.0.0.1/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }
