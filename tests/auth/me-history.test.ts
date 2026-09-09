import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  configured: true,
  getUser: vi.fn(),
  createClient: vi.fn(),
  queryResult: { data: [], error: null, status: 200, statusText: 'OK' } as { data: unknown[] | null; error: unknown; status: number; statusText: string },
}))

vi.mock('@/lib/supabase/server', () => ({
  get isSupabaseConfigured() { return authState.configured },
  createClient: authState.createClient,
}))

import { GET } from '../../src/app/api/me/history/route'

describe('GET /api/me/history authentication boundary', () => {
  beforeEach(() => {
    authState.configured = true
    authState.getUser.mockReset()
    authState.queryResult = { data: [], error: null, status: 200, statusText: 'OK' }
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve(authState.queryResult)),
    }
    authState.createClient.mockReset().mockReturnValue({ auth: { getUser: authState.getUser }, from: vi.fn(() => query) })
  })

  it('returns an explicit 503 before accessing Supabase when configuration is absent', async () => {
    authState.configured = false
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error.code).toBe('SUPABASE_UNAVAILABLE')
    expect(authState.createClient).not.toHaveBeenCalled()
  })

  it.each([
    [{ data: { user: null }, error: null }],
    [{ data: { user: null }, error: { name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing' } }],
    [{ data: { user: null }, error: { name: 'AuthApiError', status: 401, message: 'Invalid JWT' } }],
  ])('returns 401 for an absent or invalid session', async authResult => {
    authState.getUser.mockResolvedValueOnce(authResult)
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error.code).toBe('AUTH_REQUIRED')
  })

  it.each([
    { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' },
    { name: 'UnexpectedAuthError', status: 500, message: 'unexpected' },
  ])('returns 503 for an auth dependency error: $name', async authError => {
    authState.getUser.mockResolvedValueOnce({ data: { user: null }, error: authError })
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error.code).toBe('SUPABASE_UNAVAILABLE')
  })

  it('returns 503 when the auth request rejects', async () => {
    authState.getUser.mockRejectedValueOnce(new Error('network unavailable'))
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error.code).toBe('SUPABASE_UNAVAILABLE')
  })

  it.each([
    [0, ''],
    [503, 'Service Unavailable'],
  ])('returns 503 when an authenticated history query has top-level status %s', async (status, statusText) => {
    authState.getUser.mockResolvedValueOnce({ data: { user: { id: '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7' } }, error: null })
    authState.queryResult = { data: null, error: { code: '', message: 'request failed' }, status, statusText }
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error.code).toBe('SUPABASE_UNAVAILABLE')
  })

  it('keeps a database application/query error as 500', async () => {
    authState.getUser.mockResolvedValueOnce({ data: { user: { id: '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7' } }, error: null })
    authState.queryResult = { data: null, error: { code: 'XX000', message: 'database application error' }, status: 500, statusText: 'Internal Server Error' }
    const response = await GET()

    expect(response.status).toBe(500)
  })
})
