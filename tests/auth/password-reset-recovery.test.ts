import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  hasBoundRecoverySession: vi.fn(),
  clearAuthCookies: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/auth/bff', () => ({
  createAuthBff: () => ({
    client: { auth: { getSession: authState.getSession, updateUser: authState.updateUser, signOut: authState.signOut } },
    apply: (response: Response) => response,
  }),
  hasBoundRecoverySession: authState.hasBoundRecoverySession,
  clearAuthCookies: authState.clearAuthCookies,
  isAuthConfigured: () => true,
}))

vi.mock('@/lib/auth/contracts', () => ({
  readStrictObject: (value: unknown, allowed: readonly string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const payload = value as Record<string, unknown>
    return Object.keys(payload).every(key => allowed.includes(key)) ? payload : null
  },
  validPassword: (value: unknown) => typeof value === 'string' && value.length >= 12,
}))

vi.mock('@/lib/auth/http', () => ({
  empty: (status = 204) => new Response(null, { status }),
  failure: (status: number, code: string, message: string, requestId: string) => Response.json({ error: { code, message, requestId } }, { status }),
  readJson: (request: Request) => request.json().catch(() => null),
  requestId: () => 'synthetic-request-id',
  verifyMutationRequest: () => ({ ok: true }),
}))

vi.mock('@/lib/auth/server', () => ({ getAuthenticatedUser: authState.getAuthenticatedUser }))

import { POST } from '../../src/app/api/auth/password/reset/route'

function resetRequest(): NextRequest {
  return new NextRequest('http://localhost:3200/api/auth/password/reset', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'new-password-123' }),
  })
}

describe('POST /api/auth/password/reset recovery binding and consumption', () => {
  beforeEach(() => {
    authState.getAuthenticatedUser.mockReset().mockResolvedValue({ id: 'recovery-user' })
    authState.getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'recovery-session-token' } }, error: null })
    authState.updateUser.mockReset().mockResolvedValue({ error: null })
    authState.signOut.mockReset().mockResolvedValue({ error: null })
    authState.hasBoundRecoverySession.mockReset().mockReturnValue(true)
    authState.clearAuthCookies.mockReset()
  })

  it('rejects an account-switched session before updating its password', async () => {
    authState.getAuthenticatedUser.mockResolvedValueOnce({ id: 'other-user' })
    authState.hasBoundRecoverySession.mockReturnValueOnce(false)

    const response = await POST(resetRequest())

    expect(response.status).toBe(401)
    expect(authState.updateUser).not.toHaveBeenCalled()
    expect(authState.clearAuthCookies).toHaveBeenCalledOnce()
  })

  it('updates only a bound recovery identity, revokes the session, and clears proof cookies', async () => {
    const response = await POST(resetRequest())

    expect(response.status).toBe(204)
    expect(authState.hasBoundRecoverySession).toHaveBeenCalledWith(expect.anything(), 'recovery-user', 'recovery-session-token')
    expect(authState.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' })
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(authState.clearAuthCookies).toHaveBeenCalledOnce()
  })

  it('still clears the local recovery proof if remote session revocation has a transient failure', async () => {
    authState.signOut.mockRejectedValueOnce(new Error('network unavailable'))

    const response = await POST(resetRequest())

    expect(response.status).toBe(204)
    expect(authState.clearAuthCookies).toHaveBeenCalledOnce()
  })
})
