import { NextRequest } from 'next/server'
import { clearCookie, createAuthBff, hasRecoverySession, isAuthConfigured, recoveryCookieName } from '@/lib/auth/bff'
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
  if (!hasRecoverySession(request)) return failure(401, 'RECOVERY_SESSION_REQUIRED', '请从刚收到的重置邮件重新进入此页面。', id)
  const bff = createAuthBff(request)
  if (!await getAuthenticatedUser(bff)) return failure(401, 'RECOVERY_SESSION_REQUIRED', '重置会话已失效，请重新发送重置邮件。', id)
  const { error } = await bff.client.auth.updateUser({ password: payload.password })
  if (error) return failure(503, 'AUTH_UNAVAILABLE', '密码暂未更新，请重新验证后再试。', id)
  const response = empty()
  clearCookie(response, recoveryCookieName())
  return bff.apply(response)
}
