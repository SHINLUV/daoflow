import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('production stack environment generator', () => {
  it('generates every BFF, proxy, rate-limit, and worker runtime value', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-stack-env-'))
    temporaryDirectories.push(directory)
    const output = join(directory, 'stack.env')
    const script = resolve('ops/production/generate-stack-env.mjs')

    execFileSync(process.execPath, [
      script,
      '--verification',
      '--force',
      '--output', output,
      '--vendor-dir', '/tmp/supabase',
      '--release', 'test-release',
    ], { stdio: 'pipe' })

    const environment = Object.fromEntries(readFileSync(output, 'utf8')
      .split(/\r?\n/)
      .filter(line => line.includes('='))
      .map(line => line.split(/=(.*)/s).slice(0, 2)))

    const independentSecrets = [
      environment.DAOFLOW_AUTH_TRANSACTION_SECRET,
      environment.DAOFLOW_RATE_LIMIT_HMAC_KEY,
      environment.DAOFLOW_PROXY_ATTESTATION_SECRET,
      environment.DAOFLOW_ASK_WORKER_TOKEN,
    ]
    expect(independentSecrets.every(value => typeof value === 'string' && value.length >= 32)).toBe(true)
    expect(new Set(independentSecrets).size).toBe(independentSecrets.length)
    expect(environment.DAOFLOW_ASK_WORKER_ID).toMatch(/^[0-9a-f-]{36}$/i)
    expect(environment.DAOFLOW_CORPUS_VERSION).toBe('dao-de-jing-wang-bi-v1')
    expect(environment.DAOFLOW_PUBLIC_ORIGIN).toBe('http://127.0.0.1:18183')
  })
})
