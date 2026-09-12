import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const authState = vi.hoisted(() => ({
  configured: true,
  exchangeCodeForSession: vi.fn(),
  markRecoverySession: vi.fn(),
  transaction: null as { purpose: 'signup' | 'recovery'; next: string } | null,
}))

vi.mock('@/lib/auth/bff', () => ({
  createAuthBff: () => ({ client: { auth: { exchangeCodeForSession: authState.exchangeCodeForSession } }, apply: (response: NextResponse) => response }),
  isAuthConfigured: () => authState.configured,
  clearAuthCookies: vi.fn(),
  clearCookie: vi.fn(),
  markRecoverySession: authState.markRecoverySession,
  recoveryCookieName: () => 'daoflow-dev-recovery',
  transactionCookieName: () => 'daoflow-dev-auth-tx',
  noStoreRedirect: (location: URL) => NextResponse.redirect(location),
}))
vi.mock('@/lib/auth/transactions', () => ({ verifyAuthTransaction: () => authState.transaction }))
vi.mock('@/lib/auth/safeNext', async () => import('../../src/lib/auth/safeNext'))

import { GET } from '../../src/app/auth/callback/route'

describe('auth callback route', () => {
  beforeEach(() => {
    authState.configured = true
    authState.exchangeCodeForSession.mockReset().mockResolvedValue({ data: { user: { id: 'synthetic-user' }, session: { access_token: 'synthetic-session-token' } }, error: null })
    authState.markRecoverySession.mockReset().mockReturnValue(true)
    authState.transaction = null
  })

  it.each([
    ['failed', 'code=expired', { message: 'expired' }],
    ['missing-code', '', null],
  ])('retains the safe destination when callback status is %s', async (status, query, exchangeError) => {
    if (exchangeError) authState.exchangeCodeForSession.mockResolvedValueOnce({ error: exchangeError })
    const response = await GET(new Request(`https://daoflow.test/auth/callback?${query}${query ? '&' : ''}next=%2Fjournal%2Fnew%3FdraftId%3Ddraft-1`))
    const location = new URL(response.headers.get('location')!)

    expect(location.origin).toBe('https://daoflow.test')
    expect(location.pathname).toBe('/auth/login')
    expect(location.searchParams.get('auth')).toBe(status)
    expect(location.searchParams.get('next')).toBe('/journal/new?draftId=draft-1')
  })

  it('retains the safe destination when authentication is unavailable', async () => {
    authState.configured = false
    const response = await GET(new Request('https://daoflow.test/auth/callback?code=value&next=%2Fjournal'))
    const location = new URL(response.headers.get('location')!)

    expect(location.pathname).toBe('/auth/login')
    expect(location.searchParams.get('auth')).toBe('unavailable')
    expect(location.searchParams.get('next')).toBe('/journal')
  })

  it('turns an unavailable exchange operation into a recoverable redirect', async () => {
    authState.exchangeCodeForSession.mockRejectedValueOnce(new Error('network unavailable'))
    const response = await GET(new Request('https://daoflow.test/auth/callback?code=value&next=%2Fjournal%2Fnew'))
    const location = new URL(response.headers.get('location')!)

    expect(location.pathname).toBe('/auth/login')
    expect(location.searchParams.get('auth')).toBe('unavailable')
    expect(location.searchParams.get('next')).toBe('/journal/new')
  })

  it('never redirects a successful exchange to a control-character authority', async () => {
    const response = await GET(new Request('https://daoflow.test/auth/callback?code=value&next=%2F%2509%2Fevil.example'))
    expect(response.headers.get('location')).toBe('https://daoflow.test/auth/complete?next=%2Fjournal')
  })

  it('uses the backend request origin when no proxy attestation authorizes forwarded metadata', async () => {
    const response = await GET(new Request('http://localhost:3200/auth/callback?code=value&next=%2Fmy-dao', { headers: { host: '127.0.0.1:3200' } }))
    expect(response.headers.get('location')).toBe('http://localhost:3200/auth/complete?next=%2Fmy-dao')
  })

  it('uses a trusted proxy browser origin for the callback completion redirect', async () => {
    const previous = process.env.DAOFLOW_PROXY_ATTESTATION_SECRET
    process.env.DAOFLOW_PROXY_ATTESTATION_SECRET = 'p'.repeat(32)
    try {
      const response = await GET(new Request('http://127.0.0.1:3200/auth/callback?code=value&next=%2Fmy-dao', {
        headers: {
          host: '127.0.0.1:3200',
          'x-forwarded-host': '127.0.0.1:3210',
          'x-forwarded-proto': 'http',
          'x-daoflow-proxy-attestation': 'p'.repeat(32),
        },
      }))
      expect(response.headers.get('location')).toBe('http://127.0.0.1:3210/auth/complete?next=%2Fmy-dao')
    } finally {
      if (previous === undefined) delete process.env.DAOFLOW_PROXY_ATTESTATION_SECRET
      else process.env.DAOFLOW_PROXY_ATTESTATION_SECRET = previous
    }
  })

  it('binds a recovery callback proof to the Auth user and exchanged BFF session', async () => {
    authState.transaction = { purpose: 'recovery', next: '/journal' }

    const response = await GET(new Request('https://daoflow.test/auth/callback?code=value&transaction=synthetic-nonce'))
    const location = new URL(response.headers.get('location')!)

    expect(location.pathname).toBe('/auth/complete')
    expect(location.searchParams.get('next')).toBe('/auth/reset-password')
    expect(authState.markRecoverySession).toHaveBeenCalledWith(expect.anything(), 'synthetic-user', 'synthetic-session-token', expect.anything())
  })
})
