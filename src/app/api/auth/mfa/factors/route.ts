import { NextRequest } from 'next/server'
import { createAuthBff, isAuthConfigured } from '@/lib/auth/bff'
import { failure, json, requestId } from '@/lib/auth/http'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  const id = requestId()
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  if (!await getAuthenticatedUser(bff)) return failure(401, 'AUTH_REQUIRED', '请先登录后管理双重验证。', id)
  const { data, error } = await bff.client.auth.mfa.listFactors()
  if (error || !data) return failure(503, 'MFA_UNAVAILABLE', '双重验证服务暂时不可用。', id)
  const factors = data.all.map(factor => ({ id: factor.id, type: factor.factor_type, status: factor.status, createdAt: factor.created_at }))
  return bff.apply(json({ factors }))
}
