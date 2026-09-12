import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = [
  'ops/local/Caddyfile.loopback',
  'ops/production/Caddyfile.daoflow',
]

describe('Caddy forwarded-authority provenance', () => {
  it.each(files)('%s replaces forwarded authority exactly once at the trusted proxy hop', file => {
    const caddyfile = readFileSync(resolve(process.cwd(), file), 'utf8')
    for (const header of ['Host', 'Proto']) {
      const injection = `header_up X-Forwarded-${header}`
      expect(caddyfile.match(new RegExp(injection, 'g'))).toHaveLength(1)
      expect(caddyfile).not.toContain(`header_up -X-Forwarded-${header}`)
    }
  })

  it('uses Caddy request metadata rather than a client-controlled Host header in production', () => {
    const caddyfile = readFileSync(resolve(process.cwd(), 'ops/production/Caddyfile.daoflow'), 'utf8')
    expect(caddyfile).toContain('header_up X-Forwarded-Host {http.request.host}')
    expect(caddyfile).not.toContain('{http.request.header.Host}')
  })
})
