import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ configured: false, createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  get isSupabaseConfigured() { return state.configured },
  createClient: state.createClient,
}))

import { listMyHallPublications, listPublicHall } from '../../src/lib/hall/service'

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
})
