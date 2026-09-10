import { NextRequest } from 'next/server'
import { createAuthBff, isAuthConfigured } from '@/lib/auth/bff'
import { readStrictObject, readString } from '@/lib/auth/contracts'
import { failure, json, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['factorId'])
  const factorId = readString(payload?.factorId, 128)
  if (!payload || !factorId) return failure(400, 'INVALID_INPUT', '验证器信息不正确。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  if (!await getAuthenticatedUser(bff)) return failure(401, 'AUTH_REQUIRED', '请先登录后验证双重验证器。', id)
  const { data, error } = await bff.client.auth.mfa.challenge({ factorId })
  if (error || !data) return failure(503, 'MFA_UNAVAILABLE', '验证挑战暂时不可用。', id)
  return bff.apply(json({ factorId, challengeId: data.id }))
}
