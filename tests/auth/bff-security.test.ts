import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { readStrictObject } from '../../src/lib/auth/contracts'
import { csrfCookieName, issueCsrfToken, json, verifyMutationRequest } from '../../src/lib/auth/http'
import { startAuthTransaction, verifyAuthTransaction } from '../../src/lib/auth/transactions'

const originalTransactionSecret = process.env.DAOFLOW_AUTH_TRANSACTION_SECRET

afterEach(() => {
  if (originalTransactionSecret === undefined) delete process.env.DAOFLOW_AUTH_TRANSACTION_SECRET
  else process.env.DAOFLOW_AUTH_TRANSACTION_SECRET = originalTransactionSecret
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
