import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const runtimeReader = readFileSync(resolve(process.cwd(), 'src/lib/runtime-env.ts'), 'utf8')
const affected = [
  'src/lib/auth/http.ts',
  'src/lib/auth/bff.ts',
  'src/lib/auth/transactions.ts',
  'src/lib/auth/rateLimit.ts',
  'src/lib/ask-worker/runtime.ts',
  'src/app/api/internal/ask-worker/route.ts',
]
const standaloneRoot = resolve(process.cwd(), '.next/standalone')
const runtimeKeys = [
  'DAOFLOW_PROXY_ATTESTATION_SECRET',
  'DAOFLOW_AUTH_TRANSACTION_SECRET',
  'DAOFLOW_RATE_LIMIT_HMAC_KEY',
  'DAOFLOW_ASK_WORKER_TOKEN',
]

function bundledText(root: string): string {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(root, entry.name)
    return entry.isDirectory() ? [bundledText(path)] : [readFileSync(path, 'utf8')]
  }).join('\n')
}

describe('runtime-only DaoFlow configuration', () => {
  it('reads configuration through a computed runtime environment key', () => {
    expect(runtimeReader).toContain("globalThis as typeof globalThis & { process?: ProcessLike })['process']")
    expect(runtimeReader).toContain('runtimeProcess?.env?.[name]')
  })

  it.each(affected)('%s does not use a direct DAOFLOW process.env property', file => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    expect(source).toContain('runtimeEnv(')
    expect(source).not.toMatch(/process\.env\.DAOFLOW_[A-Z0-9_]+/)
  })

  it.runIf(existsSync(standaloneRoot))('retains required runtime configuration keys in standalone output', () => {
    const standaloneText = bundledText(standaloneRoot)
    for (const key of runtimeKeys) expect(standaloneText).toContain(key)
  })
})
