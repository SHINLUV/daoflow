import type { Favorite, Page } from './contracts'
import { getLocalChapter } from '../chapters'

export const FAVORITES_PAGE_SIZE = 20

export function createFavoriteOwnerCoordinator(
  applyOwner: (ownerId: string | null) => boolean,
  ensureInitialLoad: () => void,
) {
  let authEventObserved = false
  let initialSettled = false
  const settleInitial = (changed: boolean) => {
    if (!initialSettled && !changed) ensureInitialLoad()
    initialSettled = true
  }
  return {
    observe(ownerId: string | null) {
      authEventObserved = true
      settleInitial(applyOwner(ownerId))
    },
    resolveGetUser(ownerId: string | null) {
      if (authEventObserved) return
      settleInitial(applyOwner(ownerId))
    },
  }
}

type FavoriteRow = {
  id: string
  chapter_id: number
  excerpt: string
  note: string | null
  version: number
  created_at: string
  updated_at: string
}

export type FavoriteCreateInput = {
  id: string
  chapterId: number
  excerpt: string
  note: string | null
}

export type FavoritePatchInput = { version: number; note: string | null }

export function toFavorite(row: FavoriteRow): Favorite {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    excerpt: row.excerpt,
    note: row.note,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function isTrustedExcerpt(chapterId: number, excerpt: string): boolean {
  const chapter = getLocalChapter(chapterId)
  return Boolean(chapter && excerpt.trim().length > 0 && chapter.original_text.includes(excerpt))
}

export function parseFavoriteCreate(body: unknown): FavoriteCreateInput | null {
  if (!isRecord(body)) return null
  const { id, chapterId, excerpt, note } = body
  if (typeof id !== 'string' || !isUuid(id) || !isChapterId(chapterId) || typeof excerpt !== 'string') return null
  if (note !== undefined && note !== null && typeof note !== 'string') return null
  if (typeof note === 'string' && note.length > 2000) return null
  if (!isTrustedExcerpt(chapterId, excerpt)) return null
  return { id, chapterId, excerpt, note: note ?? null }
}

export function parseFavoritePatch(body: unknown): FavoritePatchInput | null {
  if (!isRecord(body) || typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < 1) return null
  if (!Object.prototype.hasOwnProperty.call(body, 'note')) return null
  if (body.note !== null && typeof body.note !== 'string') return null
  if (typeof body.note === 'string' && body.note.length > 2000) return null
  return { version: body.version, note: body.note }
}

export function parseFavoriteDelete(body: unknown): number | null {
  if (!isRecord(body) || typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < 1) return null
  return body.version
}

export function isFavoriteId(value: string): boolean {
  return isUuid(value)
}

export function encodeFavoriteCursor(favorite: Favorite): string {
  return Buffer.from(JSON.stringify({ createdAt: favorite.createdAt, id: favorite.id })).toString('base64url')
}

export function decodeFavoriteCursor(value: string | null): { createdAt: string; id: string } | null {
  if (!value) return null
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!isRecord(decoded) || typeof decoded.createdAt !== 'string' || typeof decoded.id !== 'string' || !isUuid(decoded.id) || Number.isNaN(Date.parse(decoded.createdAt))) return null
    return { createdAt: decoded.createdAt, id: decoded.id }
  } catch {
    return null
  }
}

export function toFavoritePage(rows: FavoriteRow[]): Page<Favorite> {
  const items = rows.slice(0, FAVORITES_PAGE_SIZE).map(toFavorite)
  const hasNextPage = rows.length > FAVORITES_PAGE_SIZE
  return { items, nextCursor: hasNextPage && items.length ? encodeFavoriteCursor(items[items.length - 1]) : null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isChapterId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 81
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
