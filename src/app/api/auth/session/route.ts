import { NextRequest } from 'next/server'
import { createAuthBff, isAuthConfigured } from '@/lib/auth/bff'
import { csrfTokenFor, failure, issueCsrfToken, json, requestId } from '@/lib/auth/http'
import { sessionInfo } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  const id = requestId()
  if (!isAuthConfigured()) return failure(503, 'AUTH_UNAVAILABLE', '账户服务尚未配置。', id)
  const bff = createAuthBff(request)
  const csrfToken = csrfTokenFor(request)
  const payload = await sessionInfo(request, bff, csrfToken)
  const response = json(payload)
  issueCsrfToken(request, response, csrfToken)
  return bff.apply(response)
}
