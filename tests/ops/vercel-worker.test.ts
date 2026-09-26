import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel ask worker supervision', () => {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
  const route = readFileSync(resolve(process.cwd(), 'src/app/api/internal/ask-worker/route.ts'), 'utf8')
  const scheduler = readFileSync(resolve(process.cwd(), 'src/lib/ask-worker/vercel.ts'), 'utf8')

  it('keeps a once-per-minute recovery tick behind Vercel CRON_SECRET', () => {
    expect(config.crons).toContainEqual({ path: '/api/internal/ask-worker', schedule: '* * * * *' })
    expect(route).toContain("runtimeEnv('CRON_SECRET')")
    expect(route).toContain("request.headers.get('authorization')")
  })

  it('uses waitUntil only on Vercel and keeps failures recoverable by cron', () => {
    expect(scheduler).toContain("process.env.VERCEL !== '1'")
    expect(scheduler).toContain('waitUntil(')
    expect(scheduler).toContain('runConfiguredAskWorkerOnce')
    expect(scheduler).toContain('.catch(')
  })
})
