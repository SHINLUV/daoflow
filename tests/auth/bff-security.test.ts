import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { readStrictObject } from '../../src/lib/auth/contracts'
import { browserOrigin, csrfCookieName, issueCsrfToken, json, verifyMutationRequest } from '../../src/lib/auth/http'
import { startAuthTransaction, verifyAuthTransaction } from '../../src/lib/auth/transactions'
import { requireHallMutationProtection } from '../../src/lib/hall/http'

const originalTransactionSecret = process.env.DAOFLOW_AUTH_TRANSACTION_SECRET
const originalProxyAttestationSecret = process.env.DAOFLOW_PROXY_ATTESTATION_SECRET

afterEach(() => {
  if (originalTransactionSecret === undefined) delete process.env.DAOFLOW_AUTH_TRANSACTION_SECRET
  else process.env.DAOFLOW_AUTH_TRANSACTION_SECRET = originalTransactionSecret
  if (originalProxyAttestationSecret === undefined) delete process.env.DAOFLOW_PROXY_ATTESTATION_SECRET
  else process.env.DAOFLOW_PROXY_ATTESTATION_SECRET = originalProxyAttestationSecret
})

describe('BFF request boundary', () => {
  it('requires exact same-origin and matching double-submit CSRF token', () => {
    const seed = json({})
    const bootstrap = new NextRequest('http://localhost:3200/api/auth/session')
    const token = issueCsrfToken(bootstrap, seed)
    const accepted = new NextRequest('http://localhost:3200/api/auth/sign-out', {
      method: 'POST',
      headers: { origin: 'http://localhost:3200', cookie: `${csrfCookieName()}=${token}`, 'x-daoflow-csrf': token },
    })
    const crossSite = new NextRequest('http://localhost:3200/api/auth/sign-out', {
      method: 'POST',
      headers: { origin: 'https://attacker.invalid', cookie: `${csrfCookieName()}=${token}`, 'x-daoflow-csrf': token },
    })
    const mismatch = new NextRequest('http://localhost:3200/api/auth/sign-out', {
      method: 'POST',
      headers: { origin: 'http://localhost:3200', cookie: `${csrfCookieName()}=${token}`, 'x-daoflow-csrf': `${token}x` },
    })
    expect(verifyMutationRequest(accepted)).toEqual({ ok: true })
    expect(verifyMutationRequest(crossSite)).toMatchObject({ ok: false, code: 'ORIGIN_REJECTED' })
    expect(verifyMutationRequest(mismatch)).toMatchObject({ ok: false, code: 'CSRF_REJECTED' })
  })

  it('accepts the browser-facing forwarded authority only with a valid proxy attestation', () => {
    process.env.DAOFLOW_PROXY_ATTESTATION_SECRET = 'p'.repeat(32)
    const csrf = 'a'.repeat(64)
    const request = new NextRequest('http://127.0.0.1:3200/api/auth/password/sign-up', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        host: '127.0.0.1:3200',
        'x-forwarded-host': 'localhost:80',
        'x-forwarded-proto': 'http',
        'x-daoflow-proxy-attestation': 'p'.repeat(32),
        cookie: `${csrfCookieName()}=${csrf}`,
        'x-daoflow-csrf': csrf,
      },
    })

    expect(verifyMutationRequest(request)).toEqual({ ok: true })
    expect(browserOrigin(request)).toBe('http://localhost')
  })

  it('rejects a trusted proxy request when the browser Origin does not match its forwarded authority', () => {
    process.env.DAOFLOW_PROXY_ATTESTATION_SECRET = 'p'.repeat(32)
    const csrf = 'a'.repeat(64)
    const request = new NextRequest('http://127.0.0.1:3200/api/auth/password/sign-up', {
      method: 'POST',
      headers: {
        origin: 'http://attacker.invalid',
        host: '127.0.0.1:3200',
        'x-forwarded-host': 'localhost:80',
        'x-forwarded-proto': 'http',
        'x-daoflow-proxy-attestation': 'p'.repeat(32),
        cookie: `${csrfCookieName()}=${csrf}`,
        'x-daoflow-csrf': csrf,
      },
    })

    expect(verifyMutationRequest(request)).toMatchObject({ ok: false, code: 'ORIGIN_REJECTED' })
    expect(browserOrigin(request)).toBe('http://localhost')
  })

  it('rejects client-spoofed forwarded authority without the proxy attestation', () => {
    process.env.DAOFLOW_PROXY_ATTESTATION_SECRET = 'p'.repeat(32)
    const csrf = 'a'.repeat(64)
    const request = new NextRequest('http://127.0.0.1:3200/api/auth/password/sign-up', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        host: '127.0.0.1:3200',
        'x-forwarded-host': 'localhost:80',
        'x-forwarded-proto': 'http',
        'x-daoflow-proxy-attestation': 'client-spoof',
        cookie: `${csrfCookieName()}=${csrf}`,
        'x-daoflow-csrf': csrf,
      },
    })

    expect(verifyMutationRequest(request)).toMatchObject({ ok: false, code: 'ORIGIN_REJECTED' })
    expect(browserOrigin(request)).toBe('http://localhost:3200')
  })

  it('applies the same attested browser origin rule to anonymous Hall mutations', () => {
    process.env.DAOFLOW_PROXY_ATTESTATION_SECRET = 'p'.repeat(32)
    const csrf = 'a'.repeat(64)
    const csrfName = csrfCookieName()
    const trusted = new NextRequest('http://127.0.0.1:3200/api/hall/publications', {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:3210',
        host: '127.0.0.1:3200',
        'x-forwarded-host': '127.0.0.1:3210',
        'x-forwarded-proto': 'http',
        'x-daoflow-proxy-attestation': 'p'.repeat(32),
        cookie: `${csrfName}=${csrf}`,
        'x-daoflow-csrf': csrf,
      },
    })
    const spoofed = new NextRequest('http://127.0.0.1:3200/api/hall/publications', {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:3210',
        host: '127.0.0.1:3200',
        'x-forwarded-host': '127.0.0.1:3210',
        'x-forwarded-proto': 'http',
        'x-daoflow-proxy-attestation': 'spoofed',
        cookie: `${csrfName}=${csrf}`,
        'x-daoflow-csrf': csrf,
      },
    })

    expect(requireHallMutationProtection(trusted)).toBeNull()
    expect(requireHallMutationProtection(spoofed)).toMatchObject({ code: 'ORIGIN_REJECTED' })
  })

  it('rejects unlisted client fields rather than silently accepting control fields', () => {
    expect(readStrictObject({ email: 'test@example.com', redirectPath: '/journal' }, ['email', 'redirectPath'])).not.toBeNull()
    expect(readStrictObject({ email: 'test@example.com', owner: 'other-user' }, ['email', 'redirectPath'])).toBeNull()
  })

  it('binds a recovery callback to a short-lived signed transaction and its nonce', () => {
    process.env.DAOFLOW_AUTH_TRANSACTION_SECRET = 'a'.repeat(32)
    const request = new NextRequest('http://localhost:3200/api/auth/password/recovery')
    const response = json({})
    const transaction = startAuthTransaction(request, response, 'recovery', '/journal')
    expect(transaction).not.toBeNull()
    const cookie = response.cookies.get('daoflow-dev-auth-tx')
    const callback = new NextRequest('http://localhost:3200/auth/callback', { headers: { cookie: `daoflow-dev-auth-tx=${cookie?.value}` } })
    expect(verifyAuthTransaction(callback, transaction!.nonce)).toMatchObject({ purpose: 'recovery', next: '/journal' })
    expect(verifyAuthTransaction(callback, 'wrong-nonce')).toBeNull()
  })
})
