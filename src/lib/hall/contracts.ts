export type PublicCitation = {
  chunkId: string
  chapter: number
  quote: string
  explanation: string
}

export type PublicAnswer = {
  summary: string
  citations: PublicCitation[]
  interpretation: string
  application: string
  boundary: string
  actions: string[]
  reflection: string
}

export type PublicHallDto = {
  publicId: string
  question: string
  answer: PublicAnswer
  providerLabel: 'Agnes AI'
  promptVersion: string
  corpusVersion: string
  status: 'published'
  publishedAt: string
}

export type MyHallPublicationDto = {
  id: string
  publicId: string
  question: string
  status: 'pending' | 'published' | 'withdrawn' | 'rejected'
  version: number
  redacted: boolean
  createdAt: string
  publishedAt: string | null
  withdrawnAt: string | null
}

export type Redaction = {
  field: 'question' | 'summary' | 'interpretation' | 'application' | 'boundary' | 'reflection' | `actions.${number}`
  start: number
  end: number
}

export type HallPublishInput = {
  sessionId: string
  sourceHash: string
  questionRedactions: Redaction[]
  answerRedactions: Redaction[]
  consent: true
  idempotencyKey: string
}

export type HallWithdrawInput = { version: number }
export type HallReviewInput = { version: number; decision: 'approve' | 'reject' }
export type HallReportInput = { reason: 'privacy' | 'abuse' | 'unsafe' | 'copyright' | 'other'; note: string }
export type HallListQuery = { cursor: string | null; chapter: number | null; theme: string | null; limit: number }

export class HallInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HallInputError'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256 = /^[a-f0-9]{64}$/i
const MAX_REDACTIONS = 24
const MAX_THEME_LENGTH = 64

export function parseHallListQuery(params: URLSearchParams): HallListQuery {
  const cursorValue = params.get('cursor')
  const chapterValue = params.get('chapter')
  const themeValue = params.get('theme')
  const limitValue = params.get('limit')

  if (cursorValue !== null && (!/^[A-Za-z0-9_-]{1,512}$/.test(cursorValue))) throw new HallInputError('cursor 无效。')
  if (chapterValue !== null && (!/^\d{1,2}$/.test(chapterValue) || Number(chapterValue) < 1 || Number(chapterValue) > 81)) {
    throw new HallInputError('chapter 必须在 1 到 81 之间。')
  }
  if (themeValue !== null && (themeValue.length === 0 || themeValue.length > MAX_THEME_LENGTH || /[\u0000-\u001f]/.test(themeValue))) {
    throw new HallInputError('theme 无效。')
  }
  if (limitValue !== null && (!/^\d{1,2}$/.test(limitValue) || Number(limitValue) < 1 || Number(limitValue) > 20)) {
    throw new HallInputError('limit 必须在 1 到 20 之间。')
  }

  return { cursor: cursorValue, chapter: chapterValue === null ? null : Number(chapterValue), theme: themeValue, limit: limitValue === null ? 12 : Number(limitValue) }
}

export function parsePublishInput(value: unknown): HallPublishInput {
  const record = strictRecord(value, ['sessionId', 'sourceHash', 'questionRedactions', 'answerRedactions', 'consent', 'idempotencyKey'])
  const sessionId = requiredUuid(record.sessionId, 'sessionId')
  const sourceHash = requiredString(record.sourceHash, 'sourceHash', 64, 64)
  if (!SHA256.test(sourceHash)) throw new HallInputError('sourceHash 无效。')
  if (record.consent !== true) throw new HallInputError('必须明确同意后才能提交。')

  return {
    sessionId,
    sourceHash: sourceHash.toLowerCase(),
    questionRedactions: parseRedactions(record.questionRedactions, 'questionRedactions', new Set(['question'])),
    answerRedactions: parseRedactions(record.answerRedactions, 'answerRedactions', new Set(['summary', 'interpretation', 'application', 'boundary', 'reflection', 'actions'])),
    consent: true,
    idempotencyKey: requiredUuid(record.idempotencyKey, 'idempotencyKey'),
  }
}

export function parseWithdrawInput(value: unknown): HallWithdrawInput {
  const record = strictRecord(value, ['version'])
  return { version: positiveInteger(record.version, 'version') }
}

export function parseReviewInput(value: unknown): HallReviewInput {
  const record = strictRecord(value, ['version', 'decision'])
  if (record.decision !== 'approve' && record.decision !== 'reject') throw new HallInputError('decision 无效。')
  return { version: positiveInteger(record.version, 'version'), decision: record.decision }
}

export function parseReportInput(value: unknown): HallReportInput {
  const record = strictRecord(value, ['reason', 'note'])
  if (record.reason !== 'privacy' && record.reason !== 'abuse' && record.reason !== 'unsafe' && record.reason !== 'copyright' && record.reason !== 'other') {
    throw new HallInputError('reason 无效。')
  }
  const note = requiredString(record.note, 'note', 1, 500).trim()
  if (!note) throw new HallInputError('请简要说明举报原因。')
  return { reason: record.reason, note }
}

export function parseUuid(value: string, name: string): string {
  return requiredUuid(value, name)
}

export function toPublicHallDto(value: unknown): PublicHallDto | null {
  if (!isRecord(value) || value.status !== 'published' || value.provider !== 'agnes' || value.degraded !== false) return null
  const publicId = stringOrNull(value.public_id)
  const question = stringOrNull(value.public_question)
  const promptVersion = stringOrNull(value.prompt_version)
  const corpusVersion = stringOrNull(value.corpus_version)
  const publishedAt = stringOrNull(value.published_at)
  const answer = toPublicAnswer(value.public_answer_snapshot)
  if (!publicId || !UUID.test(publicId) || !question || !promptVersion || !corpusVersion || !publishedAt || !answer) return null
  return { publicId, question, answer, providerLabel: 'Agnes AI', promptVersion, corpusVersion, status: 'published', publishedAt }
}

export function toMyHallPublicationDto(value: unknown): MyHallPublicationDto | null {
  if (!isRecord(value)) return null
  const id = stringOrNull(value.id)
  const publicId = stringOrNull(value.public_id)
  const question = stringOrNull(value.public_question)
  const status = value.status
  const version = value.version
  const createdAt = stringOrNull(value.created_at)
  const publishedAt = nullableString(value.published_at)
  const withdrawnAt = nullableString(value.withdrawn_at)
  if (!id || !UUID.test(id) || !publicId || !UUID.test(publicId) || !question || !createdAt || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) return null
  if (status !== 'pending' && status !== 'published' && status !== 'withdrawn' && status !== 'rejected') return null
  if (typeof value.redacted !== 'boolean') return null
  return { id, publicId, question, status, version, redacted: value.redacted, createdAt, publishedAt, withdrawnAt }
}

export function toPreviewDto(value: unknown): { sessionId: string; sourceHash: string; question: string; answer: PublicAnswer } | null {
  if (!isRecord(value)) return null
  const sessionId = stringOrNull(value.session_id)
  const sourceHash = stringOrNull(value.source_hash)
  const question = stringOrNull(value.question)
  const answer = toPublicAnswer(value.answer)
  if (!sessionId || !UUID.test(sessionId) || !sourceHash || !SHA256.test(sourceHash) || !question || !answer) return null
  return { sessionId, sourceHash: sourceHash.toLowerCase(), question, answer }
}

export function toCursor(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(value) ? value : null
}

function toPublicAnswer(value: unknown): PublicAnswer | null {
  if (!isRecord(value)) return null
  const summary = stringOrNull(value.summary)
  const interpretation = stringOrNull(value.interpretation)
  const application = stringOrNull(value.application)
  const boundary = stringOrNull(value.boundary)
  const reflection = stringOrNull(value.reflection)
  if (!summary || !interpretation || !application || !boundary || !reflection || !Array.isArray(value.actions) || !Array.isArray(value.citations)) return null
  const actions = value.actions.map(stringOrNull)
  const citations = value.citations.map(toCitation)
  if (actions.some((item): item is null => item === null) || citations.some((item): item is null => item === null) || citations.length > 3) return null
  return { summary, citations: citations as PublicCitation[], interpretation, application, boundary, actions: actions as string[], reflection }
}

function toCitation(value: unknown): PublicCitation | null {
  if (!isRecord(value)) return null
  const chunkId = stringOrNull(value.chunk_id)
  const quote = stringOrNull(value.quote)
  const explanation = stringOrNull(value.explanation)
  if (!chunkId || !quote || !explanation || typeof value.chapter !== 'number' || !Number.isInteger(value.chapter) || value.chapter < 1 || value.chapter > 81) return null
  return { chunkId, chapter: value.chapter, quote, explanation }
}

function parseRedactions(value: unknown, name: string, allowed: Set<string>): Redaction[] {
  if (!Array.isArray(value) || value.length > MAX_REDACTIONS) throw new HallInputError(`${name} 无效。`)
  return value.map((item, index) => {
    const record = strictRecord(item, ['field', 'start', 'end'])
    if (typeof record.field !== 'string' || !allowedField(record.field, allowed)) throw new HallInputError(`${name}[${index}].field 无效。`)
    const start = nonNegativeInteger(record.start, `${name}[${index}].start`)
    const end = nonNegativeInteger(record.end, `${name}[${index}].end`)
    if (end <= start) throw new HallInputError(`${name}[${index}] 的范围无效。`)
    return { field: record.field as Redaction['field'], start, end }
  })
}

function allowedField(field: string, allowed: Set<string>): boolean {
  if (allowed.has(field)) return true
  return allowed.has('actions') && /^actions\.(?:[0-9]|1[0-9])$/.test(field)
}

function strictRecord(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!isRecord(value)) throw new HallInputError('请求体必须是对象。')
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new HallInputError('请求包含不允许的字段。')
  return value
}

function requiredUuid(value: unknown, name: string): string {
  const result = requiredString(value, name, 36, 36)
  if (!UUID.test(result)) throw new HallInputError(`${name} 必须是 UUID。`)
  return result
}

function requiredString(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.length < min || value.length > max || /[\u0000-\u001f]/.test(value)) throw new HallInputError(`${name} 无效。`)
  return value
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new HallInputError(`${name} 必须是正整数。`)
  return value
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new HallInputError(`${name} 必须是非负整数。`)
  return value
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 12_000 && !/[\u0000-\u001f]/.test(value) ? value : null
}

function nullableString(value: unknown): string | null {
  return value === null ? null : stringOrNull(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
