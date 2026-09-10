'use client'

import type { AuthSessionInfo } from './contracts'

export const AUTH_SYNC_STORAGE_KEY = 'daoflow:auth:changed'

type FailurePayload = { error?: { code?: string; message?: string } }

export class AuthApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(status: number, payload: FailurePayload | null) {
    super(payload?.error?.message ?? '账户服务暂时不可用，请稍后重试。')
    this.status = status
    this.code = payload?.error?.code
  }
}

async function parseFailure(response: Response): Promise<FailurePayload | null> {
  return response.json().catch(() => null) as Promise<FailurePayload | null>
}

export async function getAuthSession(): Promise<AuthSessionInfo> {
  const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) throw new AuthApiError(response.status, await parseFailure(response))
  return response.json() as Promise<AuthSessionInfo>
}

export async function postAuth(path: string, body: Record<string, unknown> = {}): Promise<Response> {
  const session = await getAuthSession()
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-daoflow-csrf': session.csrfToken },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new AuthApiError(response.status, await parseFailure(response))
  return response
}

/** Refreshes the BFF session before every private mutation and adds its CSRF proof. */
export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const session = await getAuthSession()
  const headers = new Headers(init.headers)
  headers.set('x-daoflow-csrf', session.csrfToken)
  return fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store', headers })
}

/** Contains no user data; other tabs refresh their own HttpOnly BFF session. */
export function announceAuthChange(): void {
  try { window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, crypto.randomUUID()) } catch { /* Storage can be disabled. */ }
}
