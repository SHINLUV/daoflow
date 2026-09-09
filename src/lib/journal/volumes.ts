import type { Entry, Page, TimelineItem, Volume } from './contracts'

export const JOURNAL_PAGE_SIZE = 20
export const JOURNAL_MAX_PAGE_SIZE = 50

type RecordValue = Record<string, unknown>
export class JournalQueryError extends Error {}

function isRecord(value: unknown): value is RecordValue { return !!value && typeof value === 'object' && !Array.isArray(value) }
export function isJournalUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
export function parseVolumeId(value: unknown): string { if (!isJournalUuid(value)) throw new JournalQueryError('id 必须是 UUID。'); return value }
export function parseVolumeCreate(value: unknown) {
  if (!isRecord(value) || !isJournalUuid(value.id) || typeof value.title !== 'string') throw new JournalQueryError('卷册 id 和标题无效。')
  const title = value.title.trim(); if (!title || title.length > 60) throw new JournalQueryError('卷册标题须为 1–60 个字符。')
  return { id: value.id, title }
}
export function parseVolumePatch(value: unknown) {
  if (!isRecord(value) || !Number.isInteger(value.version) || (value.version as number) < 1) throw new JournalQueryError('version 必须是正整数。')
  const hasTitle = Object.prototype.hasOwnProperty.call(value, 'title'); const hasArchived = Object.prototype.hasOwnProperty.call(value, 'archived')
  if (!hasTitle && !hasArchived) throw new JournalQueryError('请提供要修改的字段。')
  if (hasTitle && typeof value.title !== 'string') throw new JournalQueryError('标题必须是文本。')
  const title = hasTitle ? (value.title as string).trim() : null
  if (title !== null && (!title || title.length > 60)) throw new JournalQueryError('卷册标题须为 1–60 个字符。')
  if (hasArchived && typeof value.archived !== 'boolean') throw new JournalQueryError('archived 必须是布尔值。')
  return { version: value.version as number, title, hasTitle, archived: hasArchived ? value.archived as boolean : null, hasArchived }
}
export function parseJournalSearch(value: string | null) { const q = value?.trim() || null; if (q && q.length > 100) throw new JournalQueryError('搜索词不能超过 100 个字符。'); return q }
export function parseLimit(value: string | null) { const n = Number(value ?? JOURNAL_PAGE_SIZE); if (!Number.isInteger(n) || n < 1 || n > JOURNAL_MAX_PAGE_SIZE) throw new JournalQueryError('limit 必须是 1–50 的整数。'); return n }
export function cursorFor(createdAt: string, id: string, type?: string) { return Buffer.from(JSON.stringify({ createdAt, id, type }), 'utf8').toString('base64url') }
export function parseCursor(value: string | null) {
  if (!value) return null
  try { const row = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as RecordValue; if (typeof row.createdAt !== 'string' || Number.isNaN(Date.parse(row.createdAt)) || !isJournalUuid(row.id) || (row.type !== undefined && row.type !== 'entry' && row.type !== 'ask')) throw new Error(); return { createdAt: row.createdAt, id: row.id as string, type: row.type as 'entry' | 'ask' | undefined } } catch { throw new JournalQueryError('cursor 无效。') }
}
export type JournalTimelineType = 'entry' | 'ask'
export function cursorFilterForType(cursor: ReturnType<typeof parseCursor>, rowType: JournalTimelineType) {
  if (!cursor) return null
  const older = `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
  // mergeTimeline sorts the final tie by type ascending: ask, then entry.
  if (cursor.type === 'ask' && rowType === 'entry') {
    return `${older},and(created_at.eq.${cursor.createdAt},id.eq.${cursor.id})`
  }
  return older
}
export function toVolume(row: RecordValue, entryCount = 0): Volume { return { id: String(row.id), title: String(row.title), archivedAt: row.archived_at === null ? null : String(row.archived_at), version: Number(row.version), entryCount, createdAt: String(row.created_at), updatedAt: String(row.updated_at) } }
export function mergeTimeline(entries: Entry[], asks: Array<{ id: string; question: string; response: string; sourceEntryId: string | null; volumeId: string | null; createdAt: string }>, limit: number): Page<TimelineItem> {
  const all: TimelineItem[] = [...entries.map(entry => ({ type: 'entry' as const, createdAt: entry.createdAt, id: entry.id, entry })), ...asks.map(ask => ({ type: 'ask' as const, ...ask }))]
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id) || a.type.localeCompare(b.type))
  const items = all.slice(0, limit); const last = items[items.length - 1]
  return { items, nextCursor: all.length > limit && last ? cursorFor(last.createdAt, last.id, last.type) : null }
}
