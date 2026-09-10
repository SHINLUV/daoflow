import { createHmac, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index]
  if (argument === '--verification' || argument === '--force') continue
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
  args.set(argument, value)
  index += 1
}

const verification = process.argv.includes('--verification')
const force = process.argv.includes('--force')
const output = resolve(args.get('--output') ?? 'ops/production/stack.env')
const stackEnvPath = args.get('--stack-env-path') ?? (verification ? output.replaceAll('\\', '/') : '/opt/daoflow/shared/stack.env')
const siteUrl = args.get('--site-url') ?? (verification ? 'http://127.0.0.1:18183' : '')
const apiUrl = args.get('--api-url') ?? (verification ? 'http://127.0.0.1:18184' : '')
const additionalRedirectUrls = args.get('--additional-redirect-urls') ?? `${siteUrl}/**`
const vendorDir = args.get('--vendor-dir') ?? ''
const release = args.get('--release') ?? 'verify-local'

if (!siteUrl || !apiUrl || !vendorDir) {
  throw new Error('Required: --site-url, --api-url, and --vendor-dir')
}
if (!verification && (!siteUrl.startsWith('https://') || !apiUrl.startsWith('https://'))) {
  throw new Error('Production URLs must use HTTPS')
}
if (!verification && additionalRedirectUrls.split(',').some((url) => !url.trim().startsWith('https://'))) {
  throw new Error('Production redirect URLs must use HTTPS')
}
if (existsSync(output) && !force) {
  throw new Error(`Refusing to replace existing environment file: ${output}`)
}

const secret = randomBytes(48).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const expires = now + 10 * 365 * 24 * 60 * 60

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function jwt(role) {
  const unsigned = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ role, iss: 'daoflow', iat: now, exp: expires })}`
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url')
  return `${unsigned}.${signature}`
}

const anonKey = jwt('anon')
const serviceRoleKey = jwt('service_role')
const smtpUser = verification ? 'verify' : process.env.DAOFLOW_SMTP_USER
const smtpPass = verification ? 'verify' : process.env.DAOFLOW_SMTP_PASS
const smtpAdminEmail = verification ? 'verify@example.invalid' : process.env.DAOFLOW_SMTP_ADMIN_EMAIL
const agnesKey = verification ? '' : process.env.DAOFLOW_AGNES_API_KEY

if (!verification && (!smtpUser || !smtpPass || !smtpAdminEmail || !agnesKey)) {
  throw new Error('Production generation requires DAOFLOW_SMTP_USER, DAOFLOW_SMTP_PASS, DAOFLOW_SMTP_ADMIN_EMAIL, and DAOFLOW_AGNES_API_KEY')
}

const lines = [
  `DAOFLOW_STACK_ENV_FILE=${stackEnvPath}`,
  `SUPABASE_VENDOR_DIR=${vendorDir}`,
  `DAOFLOW_IMAGE_TAG=${release}`,
  `DAOFLOW_APP_PORT=${verification ? '18183' : '18083'}`,
  `DAOFLOW_API_PORT=${verification ? '18184' : '18084'}`,
  `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
  'SUPABASE_INTERNAL_URL=http://api:8000',
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
  `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
  `ANON_KEY=${anonKey}`,
  `SERVICE_ROLE_KEY=${serviceRoleKey}`,
  `JWT_SECRET=${secret}`,
  `POSTGRES_PASSWORD=${randomBytes(32).toString('base64url')}`,
  `DASHBOARD_USERNAME=daoflow-admin`,
  `DASHBOARD_PASSWORD=${randomBytes(32).toString('base64url')}`,
  `SITE_URL=${siteUrl}`,
  `API_EXTERNAL_URL=${apiUrl}/auth/v1`,
  `ADDITIONAL_REDIRECT_URLS=${additionalRedirectUrls}`,
  `SMTP_ADMIN_EMAIL=${smtpAdminEmail}`,
  'SMTP_HOST=smtp.qq.com',
  'SMTP_PORT=465',
  `SMTP_USER=${smtpUser}`,
  `SMTP_PASS=${smtpPass}`,
  'SMTP_SENDER_NAME=DaoFlow',
  'MAILER_EXTERNAL_HOSTS=dao.shinluv.cloud,tanfeng.shinluv.cloud',
  `AGNES_API_KEY=${agnesKey}`,
  'AGNES_BASE_URL=https://apihub.agnes-ai.com/v1',
  `DEEPSEEK_API_KEY=${process.env.DAOFLOW_DEEPSEEK_API_KEY ?? ''}`,
  'DEEPSEEK_BASE_URL=https://api.deepseek.com/v1',
  '',
]

const temporary = `${output}.tmp`
writeFileSync(temporary, lines.join('\n'), { encoding: 'utf8', mode: 0o600 })
renameSync(temporary, output)
chmodSync(output, 0o600)
console.log(`Environment file generated at ${output}; secret values were not printed.`)
