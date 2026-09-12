import { NextRequest } from 'next/server'
import { clearAuthCookies, clearCookie, createAuthBff, isAuthConfigured, markRecoverySession, noStoreRedirect, recoveryCookieName, transactionCookieName } from '@/lib/auth/bff'
import { browserOrigin } from '../../../lib/auth/http'
import { safeNext } from '@/lib/auth/safeNext'
import { verifyAuthTransaction } from '@/lib/auth/transactions'

export async function GET(input: Request) {
  const request = input instanceof NextRequest ? input : new NextRequest(input)
  const url = request.nextUrl
  const origin = browserOrigin(request)
  const code = url.searchParams.get('code')
  const transaction = verifyAuthTransaction(request, url.searchParams.get('transaction'))
  const legacyNext = safeNext(url.searchParams.get('next'))

  if (!isAuthConfigured()) return authFailureRedirect(origin, 'unavailable', legacyNext, request)
  if (!code) return authFailureRedirect(origin, 'missing-code', legacyNext, request)
  // A callback that carries transaction data must validate it before exchanging
  // code. A transaction-less callback is limited to the legacy magic-link path.
  if (url.searchParams.has('transaction') && !transaction) return authFailureRedirect(origin, 'failed', legacyNext, request)

  const bff = createAuthBff(request)
  try {
    const { data, error } = await bff.client.auth.exchangeCodeForSession(code)
    if (error) return authFailureRedirect(origin, 'failed', legacyNext, request)
    const response = noStoreRedirect(new URL('/auth/complete', origin))
    if (transaction?.purpose === 'recovery') {
      if (!data.user?.id || !data.session?.access_token || !await markRecoverySession(response, data.user.id, data.session.access_token, request)) {
        return authFailureRedirect(origin, 'unavailable', legacyNext, request)
      }
    } else {
      clearCookie(response, recoveryCookieName(request), request)
    }

    const finalDestination = transaction?.purpose === 'recovery'
      ? new URL('/auth/reset-password', origin)
      : new URL(transaction?.next ?? legacyNext, origin)
    const destination = new URL('/auth/complete', origin)
    destination.searchParams.set('next', `${finalDestination.pathname}${finalDestination.search}`)
    response.headers.set('location', destination.toString())
    clearCookie(response, transactionCookieName(request), request)
    return bff.apply(response)
  } catch {
    return authFailureRedirect(origin, 'unavailable', legacyNext, request)
  }
}

function authFailureRedirect(origin: string, status: string, next: string, request?: NextRequest) {
  const destination = new URL('/auth/login', origin)
  destination.searchParams.set('auth', status)
  destination.searchParams.set('next', next)
  const response = noStoreRedirect(destination)
  clearAuthCookies(response, request)
  return response
}
