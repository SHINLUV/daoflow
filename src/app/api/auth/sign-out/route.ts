import { NextRequest } from 'next/server'
import { clearAuthCookies, createAuthBff, isAuthConfigured } from '@/lib/auth/bff'
import { empty, failure, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  if (!await getAuthenticatedUser(bff)) return failure(401, 'AUTH_REQUIRED', '当前没有可退出的账户会话。', id)
  const { error } = await bff.client.auth.signOut({ scope: 'local' })
  if (error) return failure(503, 'AUTH_UNAVAILABLE', '退出服务暂时不可用。', id)
  const response = empty()
  clearAuthCookies(response, request)
  return bff.apply(response)
}
