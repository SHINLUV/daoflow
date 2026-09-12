import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { authCookieNameForHost, hasBoundRecoverySession, markRecoverySession, recoveryCookieName } from '../../src/lib/auth/bff'
import { csrfCookieName, isProduction, isProductionForHost } from '../../src/lib/auth/http'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('bound recovery proof', () => {
  it('binds the proof to exactly the verified user and BFF session without storing the token', async () => {
    vi.stubEnv('DAOFLOW_AUTH_TRANSACTION_SECRET', 'a'.repeat(32))
    const response = NextResponse.json({})
    const localRequest = new NextRequest('http://localhost:3200/auth/reset-password', { headers: { host: 'localhost:3200' } })

    expect(await markRecoverySession(response, 'recovery-user', 'synthetic-recovery-access-token', localRequest)).toBe(true)
    const cookie = response.cookies.get(recoveryCookieName(localRequest))
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('strict')
    expect(cookie?.maxAge).toBe(15 * 60)
    expect(cookie?.value).not.toContain('synthetic-recovery-access-token')

    const request = new NextRequest('http://localhost:3200/auth/reset-password', { headers: { host: 'localhost:3200', cookie: `${recoveryCookieName(localRequest)}=${cookie?.value}` } })
    expect(await hasBoundRecoverySession(request, 'recovery-user', 'synthetic-recovery-access-token')).toBe(true)
    expect(await hasBoundRecoverySession(request, 'other-user', 'synthetic-recovery-access-token')).toBe(false)
    expect(await hasBoundRecoverySession(request, 'recovery-user', 'other-session-token')).toBe(false)
  })

  it('uses development cookie names and non-Secure cookies only when the explicit loopback flag is set', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DAOFLOW_LOCAL_RUNTIME', '')
    const localRequest = new NextRequest('http://localhost:3200/api/auth/session', { headers: { host: 'localhost:3200' } })
    expect(isProduction(localRequest)).toBe(true)
    expect(csrfCookieName(localRequest)).toBe('__Host-daoflow-csrf')

    vi.stubEnv('DAOFLOW_LOCAL_RUNTIME', 'true')
    vi.stubEnv('HOSTNAME', '127.0.0.1')
    expect(isProduction(localRequest)).toBe(false)
    expect(csrfCookieName(localRequest)).toBe('daoflow-dev-csrf')
    expect(authCookieNameForHost('localhost:3200')).toBe('daoflow-dev-auth')
    expect(isProductionForHost('localhost:3200')).toBe(false)
  })

  it('does not downgrade a production request merely because a local flag leaks into its environment', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DAOFLOW_LOCAL_RUNTIME', 'true')
    vi.stubEnv('HOSTNAME', '127.0.0.1')
    const publicRequest = new NextRequest('https://daoflow.example/api/auth/session', { headers: { host: 'daoflow.example' } })

    expect(isProduction(publicRequest)).toBe(true)
    expect(csrfCookieName(publicRequest)).toBe('__Host-daoflow-csrf')
    expect(authCookieNameForHost('daoflow.example')).toBe('__Host-daoflow-auth')
    expect(isProductionForHost('daoflow.example')).toBe(true)
  })
})
