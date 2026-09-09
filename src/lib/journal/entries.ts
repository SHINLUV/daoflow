import type { CreateEntry, Entry, Mood, PatchEntry } from './contracts'

export const MOODS: readonly Mood[] = ['calm', 'uneasy', 'sad', 'angry', 'hopeful', 'mixed']
export const MAX_ENTRY_BODY_LENGTH = 10_000
export const MAX_ENTRY_TITLE_LENGTH = 60
export const MAX_ENTRY_QUERY_LENGTH = 100

type UnknownRecord = Record<string, unknown>

export type ParsedCreateEntry = {
  id: string
  body: string
  title: string | null
  mood: Mood | null
  volumeId: string | null
}

export type ParsedPatchEntry = PatchEntry & {
  hasBody: boolean
  hasTitle: boolean
  hasMood: boolean
  hasVolumeId: boolean
  hasDeleted: boolean
}

export class EntryInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntryInputError'
  }
}

function record(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EntryInputError('请求体必须是对象。')
  }
  return value as UnknownRecord
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new EntryInputError(`${field} 必须是 UUID。`)
  }
  return value
}

/** Validates route identifiers before an API handler reaches Supabase/Postgres. */
export function parseEntryId(value: unknown): string {
  return uuid(value, 'id')
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new EntryInputError(`${field} 必须是文本。`)
  const trimmed = value.trim()
  if (trimmed.length > maxLength) throw new EntryInputError(`${field} 不能超过 ${maxLength} 个字符。`)
  return trimmed || null
}

function requiredBody(value: unknown): string {
  if (typeof value !== 'string') throw new EntryInputError('正文必须是文本。')
  const body = value.trim()
  if (body.length < 1 || body.length > MAX_ENTRY_BODY_LENGTH) {
    throw new EntryInputError(`正文长度须为 1–${MAX_ENTRY_BODY_LENGTH} 个字符。`)
  }
  return body
}

function optionalMood(value: unknown): Mood | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !MOODS.includes(value as Mood)) {
    throw new EntryInputError('心情选项无效。')
  }
  return value as Mood
}

function optionalVolumeId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return uuid(value, 'volumeId')
}

export function parseCreateEntry(value: unknown): ParsedCreateEntry {
  const input = record(value)
  return {
    id: uuid(input.id, 'id'),
    body: requiredBody(input.body),
    title: optionalText(input.title, '标题', MAX_ENTRY_TITLE_LENGTH),
    mood: optionalMood(input.mood),
    volumeId: optionalVolumeId(input.volumeId),
  }
}

export function parsePatchEntry(value: unknown): ParsedPatchEntry {
  const input = record(value)
  if (!Number.isInteger(input.version) || (input.version as number) < 1) {
    throw new EntryInputError('version 必须是正整数。')
  }
  const hasBody = Object.prototype.hasOwnProperty.call(input, 'body')
  const hasTitle = Object.prototype.hasOwnProperty.call(input, 'title')
  const hasMood = Object.prototype.hasOwnProperty.call(input, 'mood')
  const hasVolumeId = Object.prototype.hasOwnProperty.call(input, 'volumeId')
  const hasDeleted = Object.prototype.hasOwnProperty.call(input, 'deleted')
  if (!hasBody && !hasTitle && !hasMood && !hasVolumeId && !hasDeleted) {
    throw new EntryInputError('请至少提供一个要修改的字段。')
  }
  if (hasDeleted && typeof input.deleted !== 'boolean') throw new EntryInputError('deleted 必须是布尔值。')
  if (hasDeleted && (hasBody || hasTitle || hasMood || hasVolumeId)) {
    throw new EntryInputError('回收或恢复记录时不能同时编辑内容。')
  }
  return {
    version: input.version as number,
    ...(hasBody ? { body: requiredBody(input.body) } : {}),
    ...(hasTitle ? { title: optionalText(input.title, '标题', MAX_ENTRY_TITLE_LENGTH) } : {}),
    ...(hasMood ? { mood: optionalMood(input.mood) } : {}),
    ...(hasVolumeId ? { volumeId: optionalVolumeId(input.volumeId) } : {}),
    ...(hasDeleted ? { deleted: input.deleted as boolean } : {}),
    hasBody,
    hasTitle,
    hasMood,
    hasVolumeId,
    hasDeleted,
  }
}

export function parsePurgeVersion(value: unknown): number {
  const input = record(value)
  if (!Number.isInteger(input.version) || (input.version as number) < 1) {
    throw new EntryInputError('version 必须是正整数。')
  }
  return input.version as number
}

export function mapEntry(row: UnknownRecord): Entry {
  return {
    id: String(row.id),
    title: row.title === null ? null : String(row.title),
    body: String(row.body),
    mood: row.mood === null ? null : row.mood as Mood,
    volumeId: row.volume_id === null ? null : String(row.volume_id),
    version: Number(row.version),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at === null ? null : String(row.deleted_at),
  }
}

export function sameCreatePayload(entry: Entry, payload: ParsedCreateEntry): boolean {
  return entry.body === payload.body
    && entry.title === payload.title
    && entry.mood === payload.mood
    && entry.volumeId === payload.volumeId
}

export function parseEntryCursor(cursor: string | null): { createdAt: string; id: string } | null {
  if (!cursor) return null
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as UnknownRecord
    const createdAt = typeof decoded.createdAt === 'string' ? decoded.createdAt : ''
    if (!Number.isFinite(Date.parse(createdAt))) throw new Error('date')
    return { createdAt, id: uuid(decoded.id, 'cursor.id') }
  } catch {
    throw new EntryInputError('cursor 无效。')
  }
}

export function makeEntryCursor(entry: Entry): string {
  return Buffer.from(JSON.stringify({ createdAt: entry.createdAt, id: entry.id }), 'utf8').toString('base64url')
}

/** Escapes a PostgREST ilike term before it is embedded in an `or(...)` filter. */
export function escapeIlikeTerm(query: string): string {
  return query.replace(/[\\%_(),.]/g, '\\$&')
}

export function parseEntryQuery(value: string | null): string | null {
  if (!value) return null
  const query = value.trim()
  if (!query) return null
  if (query.length > MAX_ENTRY_QUERY_LENGTH) throw new EntryInputError(`搜索词不能超过 ${MAX_ENTRY_QUERY_LENGTH} 个字符。`)
  return query
}

export function createPayloadForRpc(payload: ParsedCreateEntry) {
  return { p_id: payload.id, p_body: payload.body, p_title: payload.title, p_mood: payload.mood, p_volume_id: payload.volumeId }
}

export function patchPayloadForRpc(id: string, patch: ParsedPatchEntry) {
  return {
    p_id: id,
    p_version: patch.version,
    p_body: patch.body ?? null,
    p_body_set: patch.hasBody,
    p_title: patch.title ?? null,
    p_title_set: patch.hasTitle,
    p_mood: patch.mood ?? null,
    p_mood_set: patch.hasMood,
    p_volume_id: patch.volumeId ?? null,
    p_volume_set: patch.hasVolumeId,
    p_deleted: patch.deleted ?? null,
    p_deleted_set: patch.hasDeleted,
  }
}

export type NewEntryDraft = Omit<CreateEntry, 'id'> & { id?: string }
