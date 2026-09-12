import { NextRequest } from 'next/server'
import { createAuthBff, isAuthConfigured } from '@/lib/auth/bff'
import { normalizeEmail, readStrictObject, readString } from '@/lib/auth/contracts'
import { browserOrigin, failure, json, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { consumeUnauthenticatedLimit, authRateLimits } from '@/lib/auth/rateLimit'
import { safeNext } from '@/lib/auth/safeNext'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['email', 'redirectPath'])
  const email = normalizeEmail(payload?.email)
  const redirectPath = readString(payload?.redirectPath, 2048)
  if (!payload || !email || redirectPath === null) return failure(400, 'INVALID_INPUT', '请检查邮箱和跳转地址。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  const limit = await consumeUnauthenticatedLimit(bff.client, request, email, authRateLimits.otp)
  if (limit.kind === 'unavailable') return failure(503, 'AUTH_LIMITS_UNAVAILABLE', '账户安全限流尚未配置，暂不能发送验证码。', id)
  if (limit.kind === 'limited') return json({ accepted: true, retryAfterSeconds: limit.retryAfterSeconds }, 202)
  const callback = new URL('/auth/callback', browserOrigin(request))
  callback.searchParams.set('next', safeNext(redirectPath))
  const { error } = await bff.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: callback.toString() } })
  if (error) return failure(503, 'AUTH_UNAVAILABLE', '验证码服务暂时不可用，请稍后重试。', id)
  return bff.apply(json({ accepted: true }, 202))
}
