import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { clearAuthCookies, clearCookie, createAuthBff, isAuthConfigured, markRecoverySession, noStoreRedirect, transactionCookieName } from '@/lib/auth/bff'
import { noStoreHeaders } from '../../../lib/auth/http'
import { safeNext } from '@/lib/auth/safeNext'
import { verifyAuthTransaction } from '@/lib/auth/transactions'

export async function GET(input: Request) {
  const request = input instanceof NextRequest ? input : new NextRequest(input)
  const url = request.nextUrl
  const origin = callbackOrigin(request)
  if (!origin) return new NextResponse(null, { status: 503, headers: noStoreHeaders() })
  const code = url.searchParams.get('code')
  const transaction = verifyAuthTransaction(request, url.searchParams.get('transaction'))
  const legacyNext = safeNext(url.searchParams.get('next'))

  if (!isAuthConfigured()) return authFailureRedirect(origin, 'unavailable', legacyNext)
  if (!code) return authFailureRedirect(origin, 'missing-code', legacyNext)
  // A callback that carries transaction data must validate it before exchanging
  // code. A transaction-less callback is limited to the legacy magic-link path.
  if (url.searchParams.has('transaction') && !transaction) return authFailureRedirect(origin, 'failed', legacyNext)

  const bff = createAuthBff(request)
  try {
    const { error } = await bff.client.auth.exchangeCodeForSession(code)
    if (error) return authFailureRedirect(origin, 'failed', legacyNext)
  } catch {
    return authFailureRedirect(origin, 'unavailable', legacyNext)
  }

  const finalDestination = transaction?.purpose === 'recovery'
    ? new URL('/auth/reset-password', origin)
    : new URL(transaction?.next ?? legacyNext, origin)
  const destination = new URL('/auth/complete', origin)
  destination.searchParams.set('next', `${finalDestination.pathname}${finalDestination.search}`)
  const response = noStoreRedirect(destination)
  clearCookie(response, transactionCookieName())
  if (transaction?.purpose === 'recovery') markRecoverySession(response)
  return bff.apply(response)
}

function callbackOrigin(request: NextRequest): string | null {
  const configured = process.env.DAOFLOW_PUBLIC_ORIGIN
  if (configured) {
    try { return new URL(configured).origin } catch { /* fail closed below */ }
  }
  if (process.env.NODE_ENV !== 'production') {
    const host = request.headers.get('host')
    if (host === '127.0.0.1:3200' || host === 'localhost:3200') return `http://${host}`
  }
  if (process.env.NODE_ENV === 'test') return request.nextUrl.origin
  return null
}

function authFailureRedirect(origin: string, status: string, next: string) {
  const destination = new URL('/auth/login', origin)
  destination.searchParams.set('auth', status)
  destination.searchParams.set('next', next)
  const response = noStoreRedirect(destination)
  clearAuthCookies(response)
  return response
}
