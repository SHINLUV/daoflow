import { FormatError } from './callModel'
import type { RetrievalEvidence } from '@/lib/rag/types'

export const ANSWER_V2_SCHEMA_VERSION = 2 as const

export type AnswerV2Status = 'answer' | 'clarify' | 'insufficient_evidence' | 'safety_support'

export interface AnswerCitationV2 {
  chunk_id: string
  chapter: number
  quote: string
  explanation: string
}

export interface AnswerV2 {
  status: AnswerV2Status
  summary: string
  citations: AnswerCitationV2[]
  interpretation: string
  application: string
  boundary: string
  actions: string[]
  reflection: string
}

const ANSWER_FIELDS = new Set([
  'status', 'summary', 'citations', 'interpretation', 'application', 'boundary', 'actions', 'reflection',
])
const CITATION_FIELDS = new Set(['chunk_id', 'chapter', 'quote', 'explanation'])
const MAX_FIELD_LENGTH = 2400
const MAX_GENERATED_BODY_LENGTH = 1200

/**
 * Parse only one JSON object and then enforce the v2.1 contract independently
 * of the model. Agnes may wrap an otherwise exact object in one JSON code
 * fence, so that single presentation wrapper is tolerated; surrounding prose,
 * multiple blocks and partial-object extraction remain rejected.
 */
export function parseAndValidateAnswerV2(raw: string, evidence: RetrievalEvidence[]): AnswerV2 {
  if (!raw || raw.trim() === '') throw new FormatError('Agnes 返回内容为空')

  let parsed: unknown
  try {
    parsed = JSON.parse(unwrapSingleJsonFence(raw))
  } catch {
    throw new FormatError('Agnes 返回不是合法 JSON')
  }
  return validateAnswerV2(parsed, evidence)
}

function unwrapSingleJsonFence(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i)
  return fenced ? fenced[1].trim() : trimmed
}

export function validateAnswerV2(value: unknown, evidence: RetrievalEvidence[]): AnswerV2 {
  const object = objectOnly(value, '回答')
  rejectUnknownFields(object, ANSWER_FIELDS, '回答')

  const status = enumValue(object.status, ['answer', 'clarify', 'insufficient_evidence', 'safety_support'], 'status')
  const summary = textValue(object.summary, 'summary')
  const interpretation = textValue(object.interpretation, 'interpretation', true)
  const application = textValue(object.application, 'application', true)
  const boundary = textValue(object.boundary, 'boundary', true)
  const reflection = textValue(object.reflection, 'reflection', true)
  const actions = actionValues(object.actions)
  const citations = citationValues(object.citations, evidence)

  if (status === 'answer' && citations.length === 0) {
    throw new FormatError('answer 状态必须包含 1–3 条已批准原文引用')
  }
  if ((status === 'clarify' || status === 'insufficient_evidence') && reflection === '') {
    throw new FormatError(`${status} 状态必须提出具体补充问题`)
  }

  const result: AnswerV2 = { status, summary, citations, interpretation, application, boundary, actions, reflection }
  // Quotes are source evidence rather than generated prose. The text the model
  // writes for a normal response remains bounded by the v2.1 1200-character
  // ceiling even when it cites several source fragments.
  const total = [summary, interpretation, application, boundary, reflection, ...actions, ...citations.map(item => item.explanation)]
    .reduce((sum, item) => sum + item.length, 0)
  if (total > MAX_GENERATED_BODY_LENGTH) throw new FormatError('回答正文超出 1200 字上限')
  return result
}

/** Only whitespace and predefined punctuation are normalized for quote proof. */
export function normalizeQuoteForVerification(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\s\u3000，。；、：！？“”‘’「」『』（）()《》〈〉…—\-]/g, '')
}

export function quoteMatchesEvidence(quote: string, evidenceText: string): boolean {
  const normalizedQuote = normalizeQuoteForVerification(quote)
  return normalizedQuote.length > 0 && normalizeQuoteForVerification(evidenceText).includes(normalizedQuote)
}

function citationValues(value: unknown, evidence: RetrievalEvidence[]): AnswerCitationV2[] {
  if (!Array.isArray(value) || value.length > 3) throw new FormatError('citations 必须是最多 3 条的数组')
  const approved = new Map(evidence.filter(item => item.reviewStatus === 'approved').map(item => [item.chunkId, item]))
  const ids = new Set<string>()

  return value.map((item, index) => {
    const citation = objectOnly(item, `citations[${index}]`)
    rejectUnknownFields(citation, CITATION_FIELDS, `citations[${index}]`)
    const chunk_id = textValue(citation.chunk_id, `citations[${index}].chunk_id`)
    if (ids.has(chunk_id)) throw new FormatError('citations 不能重复引用同一片段')
    ids.add(chunk_id)
    const source = approved.get(chunk_id)
    if (!source) throw new FormatError(`引用 ${chunk_id} 不属于当前 approved evidence`)
    const chapter = integerValue(citation.chapter, `citations[${index}].chapter`)
    if (chapter !== source.chapter || chapter < 1 || chapter > 81) throw new FormatError(`引用 ${chunk_id} 的章节不匹配`)
    const quote = textValue(citation.quote, `citations[${index}].quote`)
    if (!quoteMatchesEvidence(quote, source.text)) throw new FormatError(`引用 ${chunk_id} 不是原文的精确片段`)
    return { chunk_id, chapter, quote, explanation: textValue(citation.explanation, `citations[${index}].explanation`) }
  })
}

function actionValues(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 2) throw new FormatError('actions 必须是最多 2 项的数组')
  return value.map((item, index) => textValue(item, `actions[${index}]`))
}

function objectOnly(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new FormatError(`${field} 必须是对象`)
  return value as Record<string, unknown>
}

function rejectUnknownFields(value: Record<string, unknown>, fields: Set<string>, field: string) {
  for (const key of Object.keys(value)) {
    if (!fields.has(key)) throw new FormatError(`${field} 包含未知字段 ${key}`)
  }
}

function enumValue(value: unknown, valid: readonly string[], field: string): AnswerV2Status {
  if (typeof value !== 'string' || !valid.includes(value)) throw new FormatError(`${field} 不合法`)
  return value as AnswerV2Status
}

function textValue(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string') throw new FormatError(`${field} 必须是字符串`)
  const normalized = value.trim()
  if (!allowEmpty && normalized === '') throw new FormatError(`${field} 不可为空`)
  if (normalized.length > MAX_FIELD_LENGTH) throw new FormatError(`${field} 超出长度上限`)
  return normalized
}

function integerValue(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new FormatError(`${field} 必须是整数`)
  return value
}
