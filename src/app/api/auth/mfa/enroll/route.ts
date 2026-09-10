import { NextRequest } from 'next/server'
import { createAuthBff, isAuthConfigured } from '@/lib/auth/bff'
import { readStrictObject } from '@/lib/auth/contracts'
import { failure, json, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), [])
  if (!payload) return failure(400, 'INVALID_INPUT', '请求内容不正确。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  if (!await getAuthenticatedUser(bff)) return failure(401, 'AUTH_REQUIRED', '请先登录后启用双重验证。', id)
  const { data, error } = await bff.client.auth.mfa.enroll({ factorType: 'totp', issuer: 'DaoFlow', friendlyName: 'DaoFlow' })
  if (error || !data) return failure(503, 'MFA_UNAVAILABLE', '双重验证暂时无法启用。', id)
  // qrCode is intentionally returned only in this authenticated enrollment response.
  // It is a setup secret, not a session token, and must never be logged or persisted by the page.
  return bff.apply(json({ factorId: data.id, qrCode: data.totp.qr_code }))
}
