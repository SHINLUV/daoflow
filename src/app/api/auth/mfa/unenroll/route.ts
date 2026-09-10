import { NextRequest } from 'next/server'
import { createAuthBff, hasRecentMfa, isAuthConfigured } from '@/lib/auth/bff'
import { readStrictObject, readString } from '@/lib/auth/contracts'
import { empty, failure, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { getAuthenticatedUser, hasAal2 } from '@/lib/auth/server'
import { canRemoveMfaFactor } from '@/lib/auth/mfa'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['factorId'])
  const factorId = readString(payload?.factorId, 128)
  if (!payload || !factorId) return failure(400, 'INVALID_INPUT', '验证器信息不正确。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  if (!await getAuthenticatedUser(bff)) return failure(401, 'AUTH_REQUIRED', '请先登录后管理双重验证。', id)
  if (!await hasAal2(bff)) return failure(403, 'MFA_AAL2_REQUIRED', '请先完成双重验证后再移除验证器。', id)
  if (!hasRecentMfa(request)) return failure(403, 'MFA_RECENT_VERIFICATION_REQUIRED', '请在 15 分钟内重新完成双重验证。', id)
  const { data: factors, error: factorsError } = await bff.client.auth.mfa.listFactors()
  const ownFactors = factors?.all ?? []
  if (factorsError || !ownFactors.some(factor => factor.id === factorId)) return failure(404, 'MFA_UNAVAILABLE', '找不到该验证器。', id)
  if (!canRemoveMfaFactor(ownFactors, factorId)) return failure(409, 'MFA_BACKUP_FACTOR_REQUIRED', '请先启用并验证另一台独立保存的备用验证器，不能移除唯一的已验证验证器。', id)
  const { error } = await bff.client.auth.mfa.unenroll({ factorId })
  if (error) return failure(503, 'MFA_UNAVAILABLE', '暂时无法移除该验证器。', id)
  return bff.apply(empty())
}
