import { NextRequest } from 'next/server'
import { createAuthBff, isAuthConfigured } from '@/lib/auth/bff'
import { readStrictObject, validPassword } from '@/lib/auth/contracts'
import { empty, failure, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['currentPassword', 'newPassword'])
  const currentPassword = payload?.currentPassword
  const newPassword = payload?.newPassword
  if (!payload || !validPassword(currentPassword) || !validPassword(newPassword)) return failure(400, 'INVALID_INPUT', '请检查当前密码，并使用至少 12 个字符的新密码。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  const user = await getAuthenticatedUser(bff)
  if (!user?.email) return failure(401, 'AUTH_REQUIRED', '请重新登录后再修改密码。', id)
  // Re-entering the existing password is the current implementation's recent
  // authentication step. It occurs only server-to-server and is never logged.
  const { error: reauthenticationError } = await bff.client.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (reauthenticationError) return failure(401, 'INVALID_CREDENTIALS', '当前密码不正确。', id)
  const { error } = await bff.client.auth.updateUser({ password: newPassword })
  if (error) return failure(503, 'AUTH_UNAVAILABLE', '密码暂未更新，请稍后重试。', id)
  return bff.apply(empty())
}
