import { NextRequest } from 'next/server'
import { createAuthBff, isAuthConfigured, markMfaRecent } from '@/lib/auth/bff'
import { readStrictObject, readString } from '@/lib/auth/contracts'
import { empty, failure, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['factorId', 'challengeId', 'code'])
  const factorId = readString(payload?.factorId, 128)
  const challengeId = readString(payload?.challengeId, 128)
  const code = readString(payload?.code, 16)
  if (!payload || !factorId || !challengeId || !code || !/^\d{6,10}$/.test(code)) return failure(400, 'INVALID_INPUT', '双重验证码格式不正确。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  if (!await getAuthenticatedUser(bff)) return failure(401, 'AUTH_REQUIRED', '请先登录后完成双重验证。', id)
  const { error } = await bff.client.auth.mfa.verify({ factorId, challengeId, code })
  if (error) return failure(401, 'INVALID_CREDENTIALS', '双重验证码无效或已过期。', id)
  const response = empty()
  markMfaRecent(response, request)
  return bff.apply(response)
}
