import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ configured: false, createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  get isSupabaseConfigured() { return state.configured },
  createClient: state.createClient,
}))

import { createHallPublication, listMyHallPublications, listPublicHall } from '../../src/lib/hall/service'

describe('hall service unavailable boundary', () => {
  beforeEach(() => {
    state.configured = false
    state.createClient.mockReset()
  })

  it('fails explicitly rather than manufacturing a static public list without the live service', async () => {
    await expect(listPublicHall({ cursor: null, chapter: null, theme: null, limit: 12 })).rejects.toMatchObject({
      status: 503,
      code: 'HALL_UNAVAILABLE',
    })
    expect(state.createClient).not.toHaveBeenCalled()
  })

  it('treats an absent browser session as authentication required, not an internal hall error', async () => {
    state.configured = true
    state.createClient.mockReturnValue({ auth: { getUser: async () => ({ data: { user: null }, error: { name: 'AuthSessionMissingError', status: 400 } }) } })
    await expect(listMyHallPublications()).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' })
  })

  it('keeps a real auth dependency failure distinct from a missing session', async () => {
    state.configured = true
    state.createClient.mockReturnValue({ auth: { getUser: async () => ({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0 } }) } })
    await expect(listMyHallPublications()).rejects.toMatchObject({ status: 503, code: 'HALL_UNAVAILABLE' })
  })

  it('maps invalid public-list filters returned by the RPC to a client input error', async () => {
    state.configured = true
    state.createClient.mockReturnValue({ rpc: async () => ({ data: null, error: { code: '22023' } }) })
    await expect(listPublicHall({ cursor: 'not-a-db-cursor', chapter: null, theme: null, limit: 12 })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_INPUT',
    })
  })

  it('maps a reused idempotency key for different content to a conflict rather than a server failure', async () => {
    state.configured = true
    state.createClient.mockReturnValue({
      auth: { getUser: async () => ({ data: { user: { id: '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7', email_confirmed_at: '2026-09-11T00:00:00.000Z' }, error: null } }) },
      rpc: async () => ({ data: null, error: { code: 'P0001', message: 'IDEMPOTENCY_CONFLICT' } }),
    })
    await expect(createHallPublication({
      sessionId: '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7',
      sourceHash: 'a'.repeat(64),
      questionRedactions: [],
      answerRedactions: [],
      consent: true,
      idempotencyKey: '753e0f9c-0d47-4c98-9667-f9466d16ec0b',
    })).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' })
  })
})
