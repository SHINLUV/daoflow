import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authState = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  markRecoverySession: vi.fn(),
  clearCookie: vi.fn(),
}))

vi.mock('@/lib/auth/bff', () => ({
  createAuthBff: () => ({
    client: { auth: { verifyOtp: authState.verifyOtp } },
    apply: (response: Response) => response,
  }),
  isAuthConfigured: () => true,
  markRecoverySession: authState.markRecoverySession,
  clearCookie: authState.clearCookie,
  recoveryCookieName: () => 'daoflow-dev-recovery',
}))

vi.mock('@/lib/auth/contracts', () => ({
  normalizeEmail: (value: unknown) => typeof value === 'string' ? value : null,
  readStrictObject: (value: unknown, allowed: readonly string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const payload = value as Record<string, unknown>
    return Object.keys(payload).every(key => allowed.includes(key)) ? payload : null
  },
  readString: (value: unknown, maxLength: number) => typeof value === 'string' && value.length <= maxLength ? value : null,
}))

vi.mock('@/lib/auth/http', () => ({
  empty: (status = 204) => new Response(null, { status }),
  failure: (status: number, code: string, message: string, requestId: string) => Response.json({ error: { code, message, requestId } }, { status }),
  readJson: (request: Request) => request.json().catch(() => null),
  requestId: () => 'synthetic-request-id',
  verifyMutationRequest: () => ({ ok: true }),
}))

import { POST } from '../../src/app/api/auth/otp/verify/route'

function recoveryRequest(flow: 'login' | 'signup' | 'recovery'): NextRequest {
  return new NextRequest('http://localhost:3200/api/auth/otp/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'synthetic@example.test', token: '123456', flow }),
  })
}

describe('POST /api/auth/otp/verify recovery boundary', () => {
  beforeEach(() => {
    authState.verifyOtp.mockReset().mockResolvedValue({ data: { user: { id: 'recovery-user' }, session: { access_token: 'recovery-session-token' } }, error: null })
    authState.markRecoverySession.mockReset().mockReturnValue(true)
    authState.clearCookie.mockReset()
  })

  it('creates the short-lived recovery proof only after a verified recovery OTP', async () => {
    const response = await POST(recoveryRequest('recovery'))

    expect(response.status).toBe(204)
    expect(authState.verifyOtp).toHaveBeenCalledWith({ email: 'synthetic@example.test', token: '123456', type: 'recovery' })
    expect(authState.markRecoverySession).toHaveBeenCalledWith(expect.anything(), 'recovery-user', 'recovery-session-token', expect.anything())
    expect(authState.clearCookie).not.toHaveBeenCalled()
  })

  it('does not grant a password-recovery proof to a normal login OTP', async () => {
    const response = await POST(recoveryRequest('login'))

    expect(response.status).toBe(204)
    expect(authState.verifyOtp).toHaveBeenCalledWith({ email: 'synthetic@example.test', token: '123456', type: 'email' })
    expect(authState.markRecoverySession).not.toHaveBeenCalled()
    expect(authState.clearCookie).toHaveBeenCalledWith(expect.anything(), 'daoflow-dev-recovery', expect.anything())
  })

  it('does not grant or retain a proof when recovery OTP verification fails', async () => {
    authState.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: 'expired' } })

    const response = await POST(recoveryRequest('recovery'))

    expect(response.status).toBe(401)
    expect(authState.markRecoverySession).not.toHaveBeenCalled()
    expect(authState.clearCookie).toHaveBeenCalledWith(expect.anything(), 'daoflow-dev-recovery', expect.anything())
  })

  it('does not grant a password-recovery proof to signup OTP', async () => {
    const response = await POST(recoveryRequest('signup'))

    expect(response.status).toBe(204)
    expect(authState.verifyOtp).toHaveBeenCalledWith({ email: 'synthetic@example.test', token: '123456', type: 'signup' })
    expect(authState.markRecoverySession).not.toHaveBeenCalled()
    expect(authState.clearCookie).toHaveBeenCalledWith(expect.anything(), 'daoflow-dev-recovery', expect.anything())
  })

  it('fails closed and clears an old proof when a verified recovery OTP lacks a usable Auth session', async () => {
    authState.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'recovery-user' }, session: { access_token: 'recovery-session-token' } }, error: null })
    authState.markRecoverySession.mockReturnValueOnce(false)

    const response = await POST(recoveryRequest('recovery'))

    expect(response.status).toBe(503)
    expect(authState.clearCookie).toHaveBeenCalledWith(expect.anything(), 'daoflow-dev-recovery', expect.anything())
  })
})
