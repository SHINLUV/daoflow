import { describe, expect, it } from 'vitest'

import { getSupabaseCookieName } from '../../src/lib/supabase/storage-key'

describe('Supabase cookie storage key', () => {
  it('stays bound to the public project URL when servers use an internal endpoint', () => {
    expect(getSupabaseCookieName('https://dao.shinluv.cloud')).toBe('sb-dao-auth-token')
    expect(getSupabaseCookieName('http://127.0.0.1:18184')).toBe('sb-127-auth-token')
  })

  it('returns undefined for missing configuration', () => {
    expect(getSupabaseCookieName(undefined)).toBeUndefined()
  })
})
