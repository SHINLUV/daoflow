import { NextRequest } from 'next/server'
import { clearAuthCookies, createAuthBff, hasBoundRecoverySession, isAuthConfigured } from '@/lib/auth/bff'
import { readStrictObject, validPassword } from '@/lib/auth/contracts'
import { empty, failure, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['password'])
  if (!payload || !validPassword(payload.password)) return failure(400, 'INVALID_INPUT', '请使用至少 12 个字符的密码。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  const user = await getAuthenticatedUser(bff)
  const { data: sessionData, error: sessionError } = await bff.client.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!user || sessionError || !accessToken || !await hasBoundRecoverySession(request, user.id, accessToken)) {
    const response = failure(401, 'RECOVERY_SESSION_REQUIRED', '重置会话已失效，请重新发送重置邮件。', id)
    const applied = bff.apply(response)
    clearAuthCookies(applied, request)
    return applied
  }
  const { error } = await bff.client.auth.updateUser({ password: payload.password })
  if (error) return failure(503, 'AUTH_UNAVAILABLE', '密码暂未更新，请重新验证后再试。', id)
  // Consume the proof by revoking the recovery session and clearing every BFF
  // cookie. A subsequent password reset must begin a fresh recovery ceremony.
  try {
    await bff.client.auth.signOut({ scope: 'global' })
  } catch {
    // The password change succeeded. Clearing local BFF cookies still prevents
    // the recovery proof from being reused if provider session revocation has a
    // transient transport failure; runtime evidence must cover that condition.
  }
  const applied = bff.apply(empty())
  clearAuthCookies(applied, request)
  return applied
}
