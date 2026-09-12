import { NextRequest } from 'next/server'
import { clearCookie, createAuthBff, isAuthConfigured, recoveryCookieName } from '@/lib/auth/bff'
import { normalizeEmail, readStrictObject, validPassword } from '@/lib/auth/contracts'
import { empty, failure, json, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { authRateLimits, checkUnauthenticatedLimit, consumeUnauthenticatedLimit } from '@/lib/auth/rateLimit'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['email', 'password'])
  const email = normalizeEmail(payload?.email)
  const password = payload?.password
  if (!payload || !email || !validPassword(password)) return failure(400, 'INVALID_INPUT', '请检查邮箱和密码。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  const before = await checkUnauthenticatedLimit(bff.client, request, email, authRateLimits.passwordFailure)
  if (before.kind === 'unavailable') return clearRecoveryProof(bff, failure(503, 'AUTH_LIMITS_UNAVAILABLE', '账户安全限流尚未配置，暂不能登录。', id), request)
  if (before.kind === 'limited') return clearRecoveryProof(bff, json({ error: { code: 'RATE_LIMITED', message: '登录尝试过多，请稍后再试。', requestId: id }, retryAfterSeconds: before.retryAfterSeconds }, 429), request)
  const { error } = await bff.client.auth.signInWithPassword({ email, password })
  if (error) {
    const recorded = await consumeUnauthenticatedLimit(bff.client, request, email, authRateLimits.passwordFailure)
    if (recorded.kind === 'unavailable') return clearRecoveryProof(bff, failure(503, 'AUTH_LIMITS_UNAVAILABLE', '账户安全限流未能确认，暂不能继续登录。', id), request)
    if (recorded.kind === 'limited') return clearRecoveryProof(bff, json({ error: { code: 'RATE_LIMITED', message: '登录尝试过多，请稍后再试。', requestId: id }, retryAfterSeconds: recorded.retryAfterSeconds }, 429), request)
    return clearRecoveryProof(bff, failure(401, 'INVALID_CREDENTIALS', '邮箱或密码不正确。', id), request)
  }
  const response = empty()
  clearCookie(response, recoveryCookieName(request), request)
  return bff.apply(response)
}

function clearRecoveryProof(bff: ReturnType<typeof createAuthBff>, response: ReturnType<typeof failure> | ReturnType<typeof json>, request: NextRequest) {
  clearCookie(response, recoveryCookieName(request), request)
  return bff.apply(response)
}
