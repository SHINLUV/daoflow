import { constants, copyFileSync, existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, chmodSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index]
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
  args.set(argument, value)
  index += 1
}

const input = resolve(args.get('--input') ?? '')
const backupSuffix = args.get('--backup-suffix') ?? ''
const publicOrigin = args.get('--public-origin') ?? ''
if (!input || !existsSync(input)) throw new Error('Required: --input must name an existing stack.env file')
if (!/^[0-9a-f]{7,40}$/i.test(backupSuffix)) throw new Error('Required: --backup-suffix must be a Git commit prefix')
if (!/^https:\/\/[^/]+$/i.test(publicOrigin)) throw new Error('Required: --public-origin must be an HTTPS origin without a path')

const backup = `${input}.pre-${backupSuffix}`
if (existsSync(backup)) throw new Error(`Refusing to replace existing backup: ${backup}`)

const original = readFileSync(input, 'utf8')
const lines = original.split(/\r?\n/)
const positions = new Map()
for (let index = 0; index < lines.length; index += 1) {
  const match = lines[index].match(/^([A-Za-z_][A-Za-z0-9_]*)=/)
  if (match && !positions.has(match[1])) positions.set(match[1], index)
}

function ensure(key, factory) {
  const position = positions.get(key)
  if (position !== undefined && lines[position].slice(key.length + 1).length > 0) return
  const value = factory()
  if (position === undefined) {
    positions.set(key, lines.length)
    lines.push(`${key}=${value}`)
  } else {
    lines[position] = `${key}=${value}`
  }
}

const secret = () => randomBytes(48).toString('base64url')
ensure('DAOFLOW_PUBLIC_ORIGIN', () => publicOrigin)
ensure('DAOFLOW_AUTH_TRANSACTION_SECRET', secret)
ensure('DAOFLOW_RATE_LIMIT_HMAC_KEY', secret)
ensure('DAOFLOW_PROXY_ATTESTATION_SECRET', secret)
ensure('DAOFLOW_ASK_WORKER_TOKEN', secret)
ensure('DAOFLOW_ASK_WORKER_ID', randomUUID)
ensure('DAOFLOW_CORPUS_VERSION', () => 'dao-de-jing-wang-bi-v1')

const mode = statSync(input).mode & 0o777
const temporary = `${input}.upgrade-${process.pid}`
try {
  copyFileSync(input, backup, constants.COPYFILE_EXCL)
  chmodSync(backup, mode)
  writeFileSync(temporary, `${lines.filter((line, index) => line !== '' || index !== lines.length - 1).join('\n')}\n`, { mode })
  chmodSync(temporary, mode)
  if (process.platform === 'win32') copyFileSync(temporary, input)
  else renameSync(temporary, input)
} finally {
  if (existsSync(temporary)) unlinkSync(temporary)
}

console.log(`Environment upgraded at ${input}; existing values were preserved and secret values were not printed.`)
