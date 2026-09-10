import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/011_auth_user_profile_cascade.sql')

describe('011 auth user profile lifecycle migration contract', () => {
  it('allows an Auth user deletion to cascade through the public profile', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toMatch(/alter table public\.users[\s\S]*drop constraint if exists users_id_fkey/i)
    expect(migration).toMatch(
      /add constraint users_id_fkey[\s\S]*foreign key \(id\) references auth\.users\(id\) on delete cascade/i,
    )
  })
})
