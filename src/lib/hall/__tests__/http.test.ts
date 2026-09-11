import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { hallJson, requireHallMutationProtection } from '../http'

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

  it('marks every hall JSON response no-store and noindex, including public reads', () => {
    const response = hallJson({ items: [] })
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })
})
