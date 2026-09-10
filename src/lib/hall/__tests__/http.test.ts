import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { requireHallMutationProtection } from '../http'

describe('hall mutation request protection', () => {
  it('rejects a mutation that lacks an exact same-origin and CSRF proof', () => {
    const request = new NextRequest('http://127.0.0.1/api/hall/publications', { method: 'POST' })
    expect(requireHallMutationProtection(request)).toMatchObject({ status: 403, code: 'ORIGIN_REJECTED' })
  })

  it('accepts the local development CSRF cookie only when it exactly matches the header', () => {
    const request = new NextRequest('http://127.0.0.1/api/hall/publications', {
      method: 'POST',
      headers: { cookie: 'daoflow-dev-csrf=known-token', 'x-daoflow-csrf': 'known-token' },
    })
    request.headers.set('origin', request.nextUrl.origin)
    expect(requireHallMutationProtection(request)).toBeNull()
  })
})
