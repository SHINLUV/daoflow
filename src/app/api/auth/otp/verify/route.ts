import { NextRequest } from 'next/server'
import { createAuthBff, isAuthConfigured } from '@/lib/auth/bff'
import { normalizeEmail, readStrictObject, readString } from '@/lib/auth/contracts'
import { empty, failure, readJson, requestId, verifyMutationRequest } from '@/lib/auth/http'

const FLOWS = new Set(['login', 'signup', 'recovery'])

export async function POST(request: NextRequest) {
  const id = requestId()
  const mutation = verifyMutationRequest(request)
  if (!mutation.ok) return failure(403, mutation.code, mutation.message, id)
  const payload = readStrictObject(await readJson(request), ['email', 'token', 'flow'])
  const email = normalizeEmail(payload?.email)
  const token = readString(payload?.token, 32)
  const flow = readString(payload?.flow, 16)
  if (!payload || !email || !token || !/^\d{6,10}$/.test(token) || !flow || !FLOWS.has(flow)) return failure(400, 'INVALID_INPUT', '验证码格式不正确。', id)
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  const type = flow === 'signup' ? 'signup' : flow === 'recovery' ? 'recovery' : 'email'
  const { error } = await bff.client.auth.verifyOtp({ email, token, type })
  if (error) return failure(401, 'INVALID_CREDENTIALS', '验证码无效、已过期或已被使用。', id)
  return bff.apply(empty())
}
