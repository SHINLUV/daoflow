export type AuthSessionInfo = {
  user: { id: string; email: string | null; emailVerified: boolean } | null
  aal: 'aal1' | 'aal2'
  csrfToken: string
}

export type ApiErrorCode =
  | 'AUTH_UNAVAILABLE'
  | 'AUTH_LIMITS_UNAVAILABLE'
  | 'AUTH_REQUIRED'
  | 'CSRF_REJECTED'
  | 'INVALID_INPUT'
  | 'INVALID_CREDENTIALS'
  | 'MFA_AAL2_REQUIRED'
  | 'MFA_RECOVERY_NOT_CONFIGURED'
  | 'MFA_RECENT_VERIFICATION_REQUIRED'
  | 'MFA_UNAVAILABLE'
  | 'ORIGIN_REJECTED'
  | 'RECOVERY_SESSION_REQUIRED'
  | 'RATE_LIMITED'

export type ApiFailure = {
  error: { code: ApiErrorCode; message: string; requestId: string }
}

export type AuthMutationFailure = ApiFailure

export const MAX_EMAIL_LENGTH = 320
export const MAX_PASSWORD_LENGTH = 1024
export const MIN_PASSWORD_LENGTH = 12

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function readStrictObject(value: unknown, allowed: readonly string[]): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  return Object.keys(value).every(key => allowed.includes(key)) ? value : null
}

export function readString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length <= maxLength ? value : null
}

export function normalizeEmail(value: unknown): string | null {
  const email = readString(value, MAX_EMAIL_LENGTH)?.trim().toLowerCase()
  // Deliberately conservative: Auth remains the final authority, but do not send
  // clearly malformed input to a provider or to the rate-limit key generator.
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH
}
