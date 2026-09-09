const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/
const PERCENT_ENCODED_CONTROL = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i
const PERCENT_ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i
const CALLBACK_ORIGIN = 'https://daoflow.invalid'

type SessionStorageLike = Pick<Storage, 'getItem' | 'key' | 'length' | 'removeItem'>

const AUTH_CALLBACK_MESSAGES: Record<string, string> = {
  failed: '登录链接无效或已经过期，请重新发送登录链接。',
  'missing-code': '登录链接不完整，请重新发送登录链接。',
  unavailable: '登录服务暂不可用，请稍后重试。',
}

/** Only accept an in-app absolute path for auth callback navigation. */
export function safeNext(path: string | null): string {
  if (!path) return '/journal'

  let decoded = path
  while (true) {
    const nextDecoded = decoded.replace(/%25/gi, '%')
    if (nextDecoded === decoded) break
    decoded = nextDecoded
  }

  const boundary = decoded.search(/[?#]/)
  const decodedPath = boundary === -1 ? decoded : decoded.slice(0, boundary)
  if (
    CONTROL_CHARACTER.test(decoded)
    || PERCENT_ENCODED_CONTROL.test(decoded)
    || decoded.includes('\\')
    || PERCENT_ENCODED_PATH_SEPARATOR.test(decodedPath)
    || !decodedPath.startsWith('/')
    || decodedPath.startsWith('//')
  ) return '/journal'

  try {
    if (new URL(path, CALLBACK_ORIGIN).origin !== CALLBACK_ORIGIN) return '/journal'
  } catch {
    return '/journal'
  }

  return path
}

export function authCallbackStatusMessage(status: string | null): string | null {
  return status ? AUTH_CALLBACK_MESSAGES[status] ?? null : null
}

export function clearDaoFlowSessionStorage(storage: SessionStorageLike, userId: string): void {
  if (!userId) return
  const keys: string[] = []
  const journalDraftPrefix = `daoflow:journal:draft:${userId}:`
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(journalDraftPrefix)) keys.push(key)
  }

  for (const key of ['daoflow:ask:entry-handoff', 'daoflow:ask:attempt']) {
    try {
      const value = storage.getItem(key)
      const parsed = value ? JSON.parse(value) as { ownerId?: unknown } : null
      if (parsed?.ownerId === userId) keys.push(key)
    } catch {
      // An unreadable value cannot be safely attributed to the signed-out account.
    }
  }
  keys.forEach(key => storage.removeItem(key))
}
