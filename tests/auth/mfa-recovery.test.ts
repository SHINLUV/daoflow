import { describe, expect, it } from 'vitest'
import { canRemoveMfaFactor } from '../../src/lib/auth/mfa'

describe('MFA backup-factor recovery policy', () => {
  it('does not permit removal of the only verified factor', () => {
    expect(canRemoveMfaFactor([{ id: 'primary', status: 'verified' }], 'primary')).toBe(false)
  })

  it('permits a verified primary to be removed only after an independently verified backup exists', () => {
    const factors = [{ id: 'primary', status: 'verified' }, { id: 'backup', status: 'verified' }]
    expect(canRemoveMfaFactor(factors, 'primary')).toBe(true)
  })

  it('allows removal of an unfinished enrollment without treating it as recovery', () => {
    const factors = [{ id: 'primary', status: 'verified' }, { id: 'unfinished', status: 'unverified' }]
    expect(canRemoveMfaFactor(factors, 'unfinished')).toBe(true)
    expect(canRemoveMfaFactor(factors, 'primary')).toBe(false)
  })
})
