import { describe, expect, it } from 'vitest'
import { createFavoriteOwnerCoordinator } from '../../src/lib/journal/favorites'

describe('FavoriteControls initial auth coordination', () => {
  it('settles the anonymous UI when the no-user auth event arrives before getUser', () => {
    let owner: string | null = null
    let loading = true
    let loads = 0
    const coordinator = createFavoriteOwnerCoordinator(nextOwner => {
      if (owner === nextOwner) return false
      owner = nextOwner
      return true
    }, () => {
      loads += 1
      // This represents the component load completing its anonymous 401 path.
      loading = false
    })

    coordinator.observe(null)
    coordinator.resolveGetUser('2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7')

    expect(owner).toBeNull()
    expect(loads).toBe(1)
    expect(loading).toBe(false)
  })
})
