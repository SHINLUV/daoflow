export type ManagedMfaFactor = { id: string; status: string }

/**
 * GoTrue's stable recovery path is a separately verified MFA factor. A user
 * may remove an unverified enrollment, or any verified factor while another
 * verified factor remains. Losing every factor has no email-only bypass.
 */
export function canRemoveMfaFactor(factors: readonly ManagedMfaFactor[], factorId: string): boolean {
  const target = factors.find(factor => factor.id === factorId)
  if (!target) return false
  if (target.status !== 'verified') return true
  return factors.filter(factor => factor.status === 'verified').length > 1
}
