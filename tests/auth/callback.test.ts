import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  configured: true,
  exchangeCodeForSession: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { exchangeCodeForSession: authState.exchangeCodeForSession } }),
  get isSupabaseConfigured() { return authState.configured },
}))
vi.mock('@/lib/auth/safeNext', async () => import('../../src/lib/auth/safeNext'))

import { GET } from '../../src/app/auth/callback/route'

describe('auth callback route', () => {
  beforeEach(() => {
    authState.configured = true
    authState.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
  })

  it.each([
    ['failed', 'code=expired', { message: 'expired' }],
    ['missing-code', '', null],
  ])('retains the safe destination when callback status is %s', async (status, query, exchangeError) => {
    if (exchangeError) authState.exchangeCodeForSession.mockResolvedValueOnce({ error: exchangeError })
    const response = await GET(new Request(`https://daoflow.test/auth/callback?${query}${query ? '&' : ''}next=%2Fjournal%2Fnew%3FdraftId%3Ddraft-1`))
    const location = new URL(response.headers.get('location')!)

    expect(location.origin).toBe('https://daoflow.test')
    expect(location.pathname).toBe('/my-dao')
    expect(location.searchParams.get('auth')).toBe(status)
    expect(location.searchParams.get('next')).toBe('/journal/new?draftId=draft-1')
  })

  it('retains the safe destination when authentication is unavailable', async () => {
    authState.configured = false
    const response = await GET(new Request('https://daoflow.test/auth/callback?code=value&next=%2Fjournal'))
    const location = new URL(response.headers.get('location')!)

    expect(location.pathname).toBe('/my-dao')
    expect(location.searchParams.get('auth')).toBe('unavailable')
    expect(location.searchParams.get('next')).toBe('/journal')
  })

  it('turns an unavailable exchange operation into a recoverable redirect', async () => {
    authState.exchangeCodeForSession.mockRejectedValueOnce(new Error('network unavailable'))
    const response = await GET(new Request('https://daoflow.test/auth/callback?code=value&next=%2Fjournal%2Fnew'))
    const location = new URL(response.headers.get('location')!)

    expect(location.pathname).toBe('/my-dao')
    expect(location.searchParams.get('auth')).toBe('unavailable')
    expect(location.searchParams.get('next')).toBe('/journal/new')
  })

  it('never redirects a successful exchange to a control-character authority', async () => {
    const response = await GET(new Request('https://daoflow.test/auth/callback?code=value&next=%2F%2509%2Fevil.example'))
    expect(response.headers.get('location')).toBe('https://daoflow.test/journal')
  })
})
