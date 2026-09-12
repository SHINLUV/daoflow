import { NextRequest } from 'next/server'
import { clearCookie, createAuthBff, isAuthConfigured, recoveryCookieName } from '@/lib/auth/bff'
import { normalizeEmail, readStrictObject, readString, validPassword } from '@/lib/auth/contracts'
import { browserOrigin, failure, json, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { consumeUnauthenticatedLimit, authRateLimits } from '@/lib/auth/rateLimit'
import { startAuthTransaction } from '@/lib/auth/transactions'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['email', 'password', 'redirectPath'])
  const email = normalizeEmail(payload?.email)
  const password = payload?.password
  const redirectPath = readString(payload?.redirectPath, 2048)
  if (!payload || !email || !validPassword(password) || redirectPath === null) return failure(400, 'INVALID_INPUT', '请使用至少 12 个字符的密码，并检查邮箱。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  const limit = await consumeUnauthenticatedLimit(bff.client, request, email, authRateLimits.signUp)
  if (limit.kind === 'unavailable') return clearRecoveryProof(bff, failure(503, 'AUTH_LIMITS_UNAVAILABLE', '账户安全限流尚未配置，暂不能注册。', id), request)
  if (limit.kind === 'limited') return clearRecoveryProof(bff, json({ accepted: true, retryAfterSeconds: limit.retryAfterSeconds }, 202), request)
  const response = json({ accepted: true }, 202)
  clearCookie(response, recoveryCookieName(request), request)
  const transaction = startAuthTransaction(request, response, 'signup', redirectPath)
  if (!transaction) return clearRecoveryProof(bff, failure(503, 'AUTH_UNAVAILABLE', '账户回调安全配置尚未完成。', id), request)
  const callback = new URL('/auth/callback', browserOrigin(request))
  callback.searchParams.set('transaction', transaction.nonce)
  const { error } = await bff.client.auth.signUp({ email, password, options: { emailRedirectTo: callback.toString() } })
  if (error) return clearRecoveryProof(bff, failure(503, 'AUTH_UNAVAILABLE', '注册服务暂时不可用，请稍后重试。', id), request)
  return bff.apply(response)
}

function clearRecoveryProof(bff: ReturnType<typeof createAuthBff>, response: ReturnType<typeof failure> | ReturnType<typeof json>, request: NextRequest) {
  clearCookie(response, recoveryCookieName(request), request)
  return bff.apply(response)
}
