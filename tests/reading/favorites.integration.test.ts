import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'
import { getLocalChapter } from '../../src/lib/chapters'
import { isFavoriteId, parseFavoriteCreate } from '../../src/lib/journal/favorites'

const appUrl = process.env.DAOFLOW_TEST_APP_URL
const cookieA = process.env.DAOFLOW_TEST_A_COOKIE
const cookieB = process.env.DAOFLOW_TEST_B_COOKIE
const hasRealFavoriteEnvironment = Boolean(appUrl && cookieA && cookieB)
const supabaseUrl = process.env.DAOFLOW_TEST_SUPABASE_URL
const supabaseAnonKey = process.env.DAOFLOW_TEST_SUPABASE_ANON_KEY
const accessTokenA = process.env.DAOFLOW_TEST_A_ACCESS_TOKEN
const hasDirectDmlFixture = Boolean(supabaseUrl && supabaseAnonKey && accessTokenA)

function requestAs(cookie: string, path: string, init?: RequestInit) {
  return fetch(new URL(path, appUrl).toString(), {
    ...init,
    headers: { cookie, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
}

describe('favorite input boundary', () => {
  it('rejects an invalid chapter and a non-continuous local original excerpt before any database call', () => {
    const chapter = getLocalChapter(8)!
    expect(parseFavoriteCreate({ id: randomUUID(), chapterId: 0, excerpt: chapter.original_text, note: null })).toBeNull()
    expect(parseFavoriteCreate({ id: randomUUID(), chapterId: 8, excerpt: '由模型编造的原文', note: null })).toBeNull()
  })

  it('recognizes only UUID route identifiers before a database request', () => {
    expect(isFavoriteId('not-a-uuid')).toBe(false)
    expect(isFavoriteId(randomUUID())).toBe(true)
  })
})

// This suite intentionally requires two real authenticated browser-cookie fixtures and a
// database migrated through 003 then 004. It does not mock RLS, RPC, or ownership behavior.
describe.runIf(hasRealFavoriteEnvironment)('favorite API with real Supabase authentication', () => {
  it('returns 400 for invalid chapter and non-original excerpt', async () => {
    const invalidChapter = await requestAs(cookieA!, '/api/journal/favorites', { method: 'POST', body: JSON.stringify({ id: randomUUID(), chapterId: 82, excerpt: '无', note: null }) })
    const inventedExcerpt = await requestAs(cookieA!, '/api/journal/favorites', { method: 'POST', body: JSON.stringify({ id: randomUUID(), chapterId: 8, excerpt: '由模型编造的原文', note: null }) })
    expect(invalidChapter.status).toBe(400)
    expect(inventedExcerpt.status).toBe(400)
  })

  it('keeps the original note for duplicate content, hides it from another user, and enforces CAS', async () => {
    const excerpt = getLocalChapter(8)!.original_text.slice(0, 8)
    const id = randomUUID()
    const firstPayload = { id, chapterId: 8, excerpt, note: '第一条批注' }
    const first = await requestAs(cookieA!, '/api/journal/favorites', { method: 'POST', body: JSON.stringify(firstPayload) })
    expect(first.status).toBe(201)
    const created = (await first.json() as { favorite: { id: string; version: number; note: string | null } }).favorite

    const retry = await requestAs(cookieA!, '/api/journal/favorites', { method: 'POST', body: JSON.stringify(firstPayload) })
    expect(retry.status).toBe(201)
    expect((await retry.json() as { favorite: { id: string } }).favorite.id).toBe(created.id)

    const changedPayload = await requestAs(cookieA!, '/api/journal/favorites', { method: 'POST', body: JSON.stringify({ ...firstPayload, note: '同 UUID 的不同批注' }) })
    expect(changedPayload.status).toBe(409)

    const duplicate = await requestAs(cookieA!, '/api/journal/favorites', { method: 'POST', body: JSON.stringify({ id: randomUUID(), chapterId: 8, excerpt, note: '不得覆盖' }) })
    expect(duplicate.status).toBe(201)
    const duplicateFavorite = (await duplicate.json() as { favorite: { id: string; note: string | null } }).favorite
    expect(duplicateFavorite.id).toBe(created.id)
    expect(duplicateFavorite.note).toBe('第一条批注')

    const otherUser = await requestAs(cookieB!, `/api/journal/favorites/${created.id}`, { method: 'PATCH', body: JSON.stringify({ version: created.version, note: '越权' }) })
    expect(otherUser.status).toBe(404)

    const staleVersion = await requestAs(cookieA!, `/api/journal/favorites/${created.id}`, { method: 'PATCH', body: JSON.stringify({ version: created.version + 1, note: '冲突' }) })
    expect(staleVersion.status).toBe(409)
  })

  it('returns the original item when identical UUID requests arrive concurrently', async () => {
    const id = randomUUID()
    const original = getLocalChapter(81)!.original_text
    const start = Math.max(0, Math.floor(Math.random() * Math.max(1, original.length - 8)))
    const payload = { id, chapterId: 81, excerpt: original.slice(start, start + 8), note: '并发重试' }
    const [left, right] = await Promise.all([
      requestAs(cookieA!, '/api/journal/favorites', { method: 'POST', body: JSON.stringify(payload) }),
      requestAs(cookieA!, '/api/journal/favorites', { method: 'POST', body: JSON.stringify(payload) }),
    ])
    expect(left.status).toBe(201)
    expect(right.status).toBe(201)
    expect((await left.json() as { favorite: { id: string } }).favorite.id).toBe(id)
    expect((await right.json() as { favorite: { id: string } }).favorite.id).toBe(id)
  })

  it('rejects malformed favorite identifiers before ownership lookup', async () => {
    const invalidPatch = await requestAs(cookieA!, '/api/journal/favorites/not-a-uuid', { method: 'PATCH', body: JSON.stringify({ version: 1, note: null }) })
    const invalidDelete = await requestAs(cookieA!, '/api/journal/favorites/not-a-uuid', { method: 'DELETE', body: JSON.stringify({ version: 1 }) })
    expect(invalidPatch.status).toBe(400)
    expect(invalidDelete.status).toBe(400)
  })

  it.runIf(Boolean(process.env.DAOFLOW_TEST_LEGACY_FAVORITE_CHAPTER))('shows a favorite imported from the legacy favorites table', async () => {
    const chapterId = Number(process.env.DAOFLOW_TEST_LEGACY_FAVORITE_CHAPTER)
    const page = await requestAs(cookieA!, `/api/journal/favorites?chapterId=${chapterId}`)
    expect(page.status).toBe(200)
    const body = await page.json() as { items: Array<{ chapterId: number; excerpt: string }> }
    const migrated = body.items.find(item => item.chapterId === chapterId)
    expect(migrated?.excerpt).toBe(getLocalChapter(chapterId)?.original_text)
  })
})

// Optional fixture for a real local Supabase REST endpoint. It deliberately uses a
// user JWT rather than service role credentials; missing variables leave it skipped.
describe.runIf(hasDirectDmlFixture)('journal_favorites direct-DML boundary', () => {
  it('rejects authenticated direct INSERT, UPDATE, and DELETE', async () => {
    const headers = {
      apikey: supabaseAnonKey!,
      authorization: `Bearer ${accessTokenA!}`,
      'content-type': 'application/json',
    }
    const id = randomUUID()
    const insert = await fetch(`${supabaseUrl}/rest/v1/journal_favorites`, {
      method: 'POST', headers, body: JSON.stringify({ id, user_id: randomUUID(), chapter_id: 1, excerpt: '道可道', note: null }),
    })
    const update = await fetch(`${supabaseUrl}/rest/v1/journal_favorites?id=eq.${id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ note: '不应直写' }),
    })
    const remove = await fetch(`${supabaseUrl}/rest/v1/journal_favorites?id=eq.${id}`, { method: 'DELETE', headers })
    for (const response of [insert, update, remove]) expect(response.ok).toBe(false)
  })
})
