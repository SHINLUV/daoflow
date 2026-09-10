'use client'

export async function mutationHeaders(): Promise<Record<string, string>> {
  const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' })
  const payload = await response.json().catch(() => null) as { csrfToken?: unknown } | null
  if (!response.ok || typeof payload?.csrfToken !== 'string' || !payload.csrfToken) {
    throw new Error('安全会话尚未就绪，请刷新后重试。')
  }
  return { 'content-type': 'application/json', 'x-daoflow-csrf': payload.csrfToken }
}

export function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: unknown } }).error
    if (typeof error?.message === 'string') return error.message
  }
  return fallback
}
