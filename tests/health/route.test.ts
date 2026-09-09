import { describe, expect, it } from 'vitest'

import { GET } from '../../src/app/api/health/route'

describe('health route', () => {
  it('returns an uncached liveness response without exposing configuration', async () => {
    const response = GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toEqual({ status: 'ok', release: 'development' })
    expect(JSON.stringify(body)).not.toMatch(/key|secret|token|supabase|agnes/i)
  })
})
