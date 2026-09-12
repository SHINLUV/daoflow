import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('production stack environment upgrader', () => {
  it('preserves existing values and adds only missing runtime configuration', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-upgrade-env-'))
    temporaryDirectories.push(directory)
    const input = join(directory, 'stack.env')
    const preserved = 'existing-auth-secret-that-must-not-change'
    writeFileSync(input, [
      'DAOFLOW_IMAGE_TAG=old-release',
      `DAOFLOW_AUTH_TRANSACTION_SECRET=${preserved}`,
      'AGNES_API_KEY=fixture-only',
      '',
    ].join('\n'), { mode: 0o600 })

    execFileSync(process.execPath, [
      resolve('ops/production/upgrade-stack-env.mjs'),
      '--input', input,
      '--backup-suffix', 'bb9683c',
      '--public-origin', 'https://dao.example.com',
    ], { stdio: 'pipe' })

    const current = environment(input)
    const backup = environment(`${input}.pre-bb9683c`)
    expect(current.DAOFLOW_AUTH_TRANSACTION_SECRET).toBe(preserved)
    expect(backup.DAOFLOW_AUTH_TRANSACTION_SECRET).toBe(preserved)
    expect(backup.DAOFLOW_RATE_LIMIT_HMAC_KEY).toBeUndefined()
    expect(current.DAOFLOW_PUBLIC_ORIGIN).toBe('https://dao.example.com')
    expect(current.DAOFLOW_RATE_LIMIT_HMAC_KEY.length).toBeGreaterThanOrEqual(32)
    expect(current.DAOFLOW_PROXY_ATTESTATION_SECRET.length).toBeGreaterThanOrEqual(32)
    expect(current.DAOFLOW_ASK_WORKER_TOKEN.length).toBeGreaterThanOrEqual(32)
    expect(current.DAOFLOW_ASK_WORKER_ID).toMatch(/^[0-9a-f-]{36}$/i)
    expect(current.DAOFLOW_CORPUS_VERSION).toBe('dao-de-jing-wang-bi-v1')
    expect(current.AGNES_API_KEY).toBe('fixture-only')
  })
})

function environment(path: string): Record<string, string> {
  return Object.fromEntries(readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(line => line.includes('='))
    .map(line => line.split(/=(.*)/s).slice(0, 2)))
}
