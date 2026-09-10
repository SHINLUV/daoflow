import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isProduction } from './http'
import { transactionCookieName } from './bff'
import { safeNext } from './safeNext'

type AuthTransactionPurpose = 'signup' | 'recovery'
type AuthTransaction = { nonce: string; purpose: AuthTransactionPurpose; next: string; expiresAt: number }

function transactionSecret(): string | null {
  const value = process.env.DAOFLOW_AUTH_TRANSACTION_SECRET
  return value && value.length >= 32 ? value : null
}

function signature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function encode(transaction: AuthTransaction, secret: string): string {
  const payload = Buffer.from(JSON.stringify(transaction)).toString('base64url')
  return `${payload}.${signature(payload, secret)}`
}

function decode(value: string | undefined, secret: string): AuthTransaction | null {
  if (!value) return null
  const [payload, suppliedSignature, ...rest] = value.split('.')
  if (!payload || !suppliedSignature || rest.length) return null
  const expectedSignature = signature(payload, secret)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AuthTransaction>
    if ((parsed.purpose !== 'signup' && parsed.purpose !== 'recovery') || typeof parsed.nonce !== 'string' || typeof parsed.next !== 'string' || typeof parsed.expiresAt !== 'number') return null
    if (parsed.expiresAt < Date.now() || parsed.expiresAt > Date.now() + 20 * 60 * 1000) return null
    return { nonce: parsed.nonce, purpose: parsed.purpose, next: safeNext(parsed.next), expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

export function startAuthTransaction(request: NextRequest, response: NextResponse, purpose: AuthTransactionPurpose, next: string): { nonce: string } | null {
  const secret = transactionSecret()
  if (!secret) return null
  const transaction: AuthTransaction = { nonce: crypto.randomUUID(), purpose, next: safeNext(next), expiresAt: Date.now() + 15 * 60 * 1000 }
  response.cookies.set({ name: transactionCookieName(), value: encode(transaction, secret), httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 15 * 60 })
  return { nonce: transaction.nonce }
}

export function verifyAuthTransaction(request: NextRequest, nonce: string | null): AuthTransaction | null {
  const secret = transactionSecret()
  if (!secret || !nonce) return null
  const transaction = decode(request.cookies.get(transactionCookieName())?.value, secret)
  return transaction && transaction.nonce === nonce ? transaction : null
}
