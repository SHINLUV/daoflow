import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/012_auth_user_dependency_cascade.sql'),
  'utf8',
)

describe('012 account deletion dependency migration contract', () => {
  it('cascades legacy rows owned by the public profile', () => {
    expect(migration).toMatch(
      /ask_sessions_user_id_fkey[\s\S]*references public\.users\(id\) on delete cascade/i,
    )
    expect(migration).toMatch(
      /favorites_user_id_fkey[\s\S]*references public\.users\(id\) on delete cascade/i,
    )
  })

  it.each([
    ['journal_entries_user_id_volume_id_fkey', 'volume_id'],
    ['journal_preferences_user_id_last_volume_id_fkey', 'last_volume_id'],
    ['ask_sessions_volume_owner_fkey', 'volume_id'],
    ['journal_ask_requests_user_id_volume_id_fkey', 'volume_id'],
    ['journal_ask_requests_user_id_session_id_fkey', 'session_id'],
  ])('clears the optional association for %s', (constraint, column) => {
    expect(migration).toMatch(
      new RegExp(`add constraint ${constraint}[\\s\\S]*on delete set null \\(${column}\\)`, 'i'),
    )
  })
})
