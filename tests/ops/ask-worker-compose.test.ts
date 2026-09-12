import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production ask worker supervision', () => {
  const compose = readFileSync(resolve(process.cwd(), 'ops/production/stack.compose.yml'), 'utf8')

  it('records a heartbeat only after a successful worker tick', () => {
    expect(compose).toContain("if(!r.ok)throw new Error('worker tick rejected')")
    expect(compose).toContain("writeFileSync('/tmp/ask-worker-heartbeat'")
  })

  it('does not inherit the web-server health check', () => {
    expect(compose).toContain("statSync('/tmp/ask-worker-heartbeat')")
    expect(compose).toContain('process.exit(age<15000?0:1)')
  })
})
