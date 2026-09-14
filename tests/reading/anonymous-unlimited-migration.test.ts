import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260915062000_remove_anonymous_ip_daily_limit.sql'),
  'utf8',
)

describe('anonymous ask limit removal migration', () => {
  it('removes the per-IP daily counter while retaining capacity and global cost guards', () => {
    expect(migration).toMatch(/create or replace function public\.reserve_anonymous_ask\(p_ip_subject text\)/i)
    expect(migration).not.toMatch(/values \('ip',\s*p_ip_subject,\s*current_date/i)
    expect(migration).not.toMatch(/ANONYMOUS_DAILY_LIMIT/i)
    expect(migration).toMatch(/ai_generation_leases[\s\S]*>= 2/i)
    expect(migration).toMatch(/scope = 'anonymous'[\s\S]*and subject = p_ip_subject/i)
    expect(migration).toMatch(/values \('global',\s*'ask',\s*current_date,\s*1\)/i)
    expect(migration).toMatch(/request_count < 300/i)
  })

  it('keeps the function service-role only', () => {
    expect(migration).toMatch(/revoke all on function public\.reserve_anonymous_ask\(text\) from public, anon, authenticated/i)
    expect(migration).toMatch(/grant execute on function public\.reserve_anonymous_ask\(text\) to service_role/i)
  })
})
