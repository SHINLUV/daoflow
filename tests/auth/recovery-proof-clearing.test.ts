import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authState = vi.hoisted(() => ({
  checkLimit: vi.fn(),
  consumeLimit: vi.fn(),
  clearCookie: vi.fn(),
}))

vi.mock('@/lib/auth/bff', () => ({
  createAuthBff: () => ({ client: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn() } }, apply: (response: Response) => response }),
  isAuthConfigured: () => true,
  clearCookie: authState.clearCookie,
  recoveryCookieName: () => 'daoflow-dev-recovery',
}))

vi.mock('@/lib/auth/contracts', () => ({
  normalizeEmail: (value: unknown) => typeof value === 'string' ? value : null,
  validPassword: (value: unknown) => typeof value === 'string' && value.length >= 12,
  readString: (value: unknown) => typeof value === 'string' ? value : null,
  readStrictObject: (value: unknown, allowed: readonly string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const payload = value as Record<string, unknown>
    return Object.keys(payload).every(key => allowed.includes(key)) ? payload : null
  },
}))

vi.mock('@/lib/auth/http', () => ({
  empty: (status = 204) => new Response(null, { status }),
  failure: (status: number, code: string, message: string, requestId: string) => Response.json({ error: { code, message, requestId } }, { status }),
  json: (payload: unknown, status = 200) => Response.json(payload, { status }),
  readJson: (request: Request) => request.json().catch(() => null),
  requestId: () => 'synthetic-request-id',
  verifyMutationRequest: () => ({ ok: true }),
}))

vi.mock('@/lib/auth/rateLimit', () => ({
  authRateLimits: { passwordFailure: {}, signUp: {}, recovery: {} },
  checkUnauthenticatedLimit: authState.checkLimit,
  consumeUnauthenticatedLimit: authState.consumeLimit,
}))
vi.mock('@/lib/auth/transactions', () => ({ startAuthTransaction: vi.fn() }))

import { POST as signIn } from '../../src/app/api/auth/password/sign-in/route'
import { POST as signUp } from '../../src/app/api/auth/password/sign-up/route'
import { POST as recovery } from '../../src/app/api/auth/password/recovery/route'

function request(path: string, body: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost:3200${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

describe('recovery proof clearing on pre-auth early returns', () => {
  beforeEach(() => {
    authState.checkLimit.mockReset().mockResolvedValue({ kind: 'limited', retryAfterSeconds: 60 })
    authState.consumeLimit.mockReset().mockResolvedValue({ kind: 'limited', retryAfterSeconds: 60 })
    authState.clearCookie.mockReset()
  })

  it('clears an old proof for rate-limited password login', async () => {
    const response = await signIn(request('/api/auth/password/sign-in', { email: 'synthetic@example.test', password: 'password-1234' }))

    expect(response.status).toBe(429)
    expect(authState.clearCookie).toHaveBeenCalledWith(expect.anything(), 'daoflow-dev-recovery', expect.anything())
  })

  it.each([
    ['/api/auth/password/sign-up', signUp],
    ['/api/auth/password/recovery', recovery],
  ])('clears an old proof for rate-limited %s', async (path, handler) => {
    const response = await handler(request(path, path.endsWith('sign-up')
      ? { email: 'synthetic@example.test', password: 'password-1234', redirectPath: '/journal' }
      : { email: 'synthetic@example.test', redirectPath: '/journal' }))

    expect(response.status).toBe(202)
    expect(authState.clearCookie).toHaveBeenCalledWith(expect.anything(), 'daoflow-dev-recovery', expect.anything())
  })
})
