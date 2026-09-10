import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { AuthBff } from './bff'
import type { AuthSessionInfo } from './contracts'

export async function getAuthenticatedUser(bff: AuthBff): Promise<User | null> {
  const { data, error } = await bff.client.auth.getUser()
  return error || !data.user ? null : data.user
}

export async function sessionInfo(request: NextRequest, bff: AuthBff, csrfToken: string): Promise<AuthSessionInfo> {
  const user = await getAuthenticatedUser(bff)
  if (!user) return { user: null, aal: 'aal1', csrfToken }
  const { data } = await bff.client.auth.mfa.getAuthenticatorAssuranceLevel()
  const aal = data?.currentLevel === 'aal2' ? 'aal2' : 'aal1'
  return {
    user: { id: user.id, email: user.email ?? null, emailVerified: Boolean(user.email_confirmed_at) },
    aal,
    csrfToken,
  }
}

export async function hasAal2(bff: AuthBff): Promise<boolean> {
  const { data, error } = await bff.client.auth.mfa.getAuthenticatorAssuranceLevel()
  return !error && data?.currentLevel === 'aal2'
}
