import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/007_security_hardening.sql')

describe('007 security hardening migration contract', () => {
  it('keeps public content readable while explicitly denying anon and authenticated writes', () => {
    const migration = readFileSync(migrationPath, 'utf8')
    for (const table of ['chapters', 'themes', 'daily_quotes', 'keyword_chapter_map']) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    }
    expect(migration).toMatch(/revoke all on table[\s\S]*from public, anon, authenticated/i)
    expect(migration).toMatch(/grant select on table[\s\S]*to anon, authenticated/i)
    expect(migration.match(/for select to anon, authenticated using \(true\)/gi)).toHaveLength(4)
  })

  it('pins the inherited trigger function search path and conditionally adds the owner key', () => {
    const migration = readFileSync(migrationPath, 'utf8')
    expect(migration).toMatch(/create or replace function public\.handle_new_user\(\)[\s\S]*security definer[\s\S]*set search_path = public, pg_temp/i)
    expect(migration).toMatch(/if not exists \([\s\S]*pg_constraint[\s\S]*journal_entries[\s\S]*alter table public\.journal_entries[\s\S]*unique \(user_id, id\)/i)
  })
})
