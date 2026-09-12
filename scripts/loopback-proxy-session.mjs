import { randomBytes } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const projectRoot = process.cwd()
const caddyName = 'daoflow-continuation-caddy'
const caddyfile = join(projectRoot, 'ops', 'local', 'Caddyfile.loopback')
const standaloneServer = join(projectRoot, '.next', 'standalone', 'server.js')

function nativeCli(command, argumentsList, options) {
  if (process.platform !== 'win32') return execFileSync(command, argumentsList, options)
  if (command === 'docker') return execFileSync('C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe', argumentsList, options)
  if (command === 'npx') return execFileSync('powershell.exe', ['-NoProfile', '-Command', '& npx --yes supabase status -o json'], options)
  return execFileSync(command, argumentsList, options)
}

if (!existsSync(caddyfile) || !existsSync(standaloneServer)) {
  throw new Error('Build output or loopback Caddy configuration is missing.')
}

// Next's standalone tracing output does not include the generated static
// assets or all route manifests. Keep this preparation beside the loopback
// launcher so a fresh build cannot leave the manual-test page as an unstyled
// shell with a client-side 404.
const standaloneRoot = join(projectRoot, '.next', 'standalone')
const nextSource = join(projectRoot, '.next')
for (const directory of ['static', 'server']) {
  const source = join(nextSource, directory)
  if (!existsSync(source)) throw new Error(`Standalone runtime source is missing: .next/${directory}`)
  mkdirSync(join(standaloneRoot, '.next'), { recursive: true })
  cpSync(source, join(standaloneRoot, '.next', directory), { recursive: true, force: true })
}
for (const runtimeFile of ['BUILD_ID', 'routes-manifest.json', 'prerender-manifest.json']) {
  const source = join(nextSource, runtimeFile)
  if (existsSync(source)) cpSync(source, join(standaloneRoot, '.next', runtimeFile), { force: true })
}
const publicRoot = join(projectRoot, 'public')
if (existsSync(publicRoot)) {
  for (const entry of readdirSync(publicRoot)) {
    cpSync(join(publicRoot, entry), join(standaloneRoot, entry), { recursive: true, force: true })
  }
}

const existing = nativeCli('docker', ['ps', '-a', '--filter', `name=^/${caddyName}$`, '--format', '{{.ID}}'], { encoding: 'utf8' }).trim()
if (existing) throw new Error('Refusing to replace an existing loopback Caddy container.')

const localEnvPath = join(projectRoot, '.env.local')
const localEnv = existsSync(localEnvPath) ? Object.fromEntries(
  readFileSync(localEnvPath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.match(/^(AGNES_API_KEY|AGNES_BASE_URL)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.trim().replace(/^"|"$/g, '')]),
) : {}
const rawStatus = nativeCli('npx', ['--yes', 'supabase', 'status', '-o', 'json'], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const status = JSON.parse(rawStatus)
const localUrl = new URL(status.API_URL)
if (!['localhost', '127.0.0.1', '::1'].includes(localUrl.hostname) || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
  throw new Error('Local Supabase session configuration is unavailable.')
}

const environment = {
  ...process.env,
  ...localEnv,
  AGNES_BASE_URL: 'https://apihub.agnes-ai.com/v1',
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  DAOFLOW_AUTH_TRANSACTION_SECRET: randomBytes(48).toString('base64url'),
  DAOFLOW_RATE_LIMIT_HMAC_KEY: randomBytes(48).toString('base64url'),
  DAOFLOW_PROXY_ATTESTATION_SECRET: randomBytes(48).toString('base64url'),
  PORT: '3200',
  HOSTNAME: '127.0.0.1',
  DAOFLOW_LOCAL_RUNTIME: 'true',
}

if (!environment.AGNES_API_KEY) throw new Error('Agnes key is unavailable to the local launcher.')

const app = spawn(process.execPath, [standaloneServer], { cwd: join(projectRoot, '.next', 'standalone'), detached: true, env: environment, stdio: 'ignore', windowsHide: true })
app.unref()

try {
  nativeCli('docker', [
    'run', '-d', '--rm', '--name', caddyName,
    '-p', '127.0.0.1:3210:80',
    '-e', 'DAOFLOW_PROXY_ATTESTATION_SECRET',
    '--mount', `type=bind,src=${caddyfile},dst=/etc/caddy/Caddyfile,readonly`,
    'caddy:2.8', 'caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile',
  ], { cwd: projectRoot, env: environment, stdio: 'ignore' })
} catch (error) {
  // Keep the startup failure explicit; the verifier can then stop only the
  // detached app process after confirming its command line.
  throw new Error(`Loopback Caddy startup failed: ${error instanceof Error ? error.message : 'unknown error'}`)
}

console.log('Loopback app and Caddy started with process-only verification secrets.')
