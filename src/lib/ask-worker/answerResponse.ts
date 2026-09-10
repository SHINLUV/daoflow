import type { AnswerCitationV2, AnswerV2, AnswerV2Status } from '@/lib/ai/answerV2'

export type StoredAnswerSnapshot = {
  schemaVersion: 2
  answerV2: AnswerV2
  provider: 'agnes' | 'none'
  model: string | null
  degraded: boolean
  promptVersion: string
  corpusVersion: string | null
  generatedAt: string
}

export type AskAnswerResponse = {
  requestId: string | null
  answerV2: AnswerV2
  provider: 'agnes' | 'none'
  persistence: 'saved' | 'generated' | 'not_requested'
  sessionId: string | null
  retrySaveAvailable: boolean
}

const STATUSES: readonly AnswerV2Status[] = ['answer', 'clarify', 'insufficient_evidence', 'safety_support']

/**
 * Stored v2 envelopes were validated against evidence before their worker
 * writes them. This defensive parser only projects the client-safe fields;
 * v1 records keep using their legacy route shape.
 */
export function storedAnswerSnapshot(value: unknown): StoredAnswerSnapshot | null {
  if (!record(value) || value.schemaVersion !== 2 || (value.provider !== 'agnes' && value.provider !== 'none')) return null
  const answerV2 = answer(value.answerV2)
  if (!answerV2 || typeof value.degraded !== 'boolean' || typeof value.promptVersion !== 'string' || typeof value.generatedAt !== 'string') return null
  if (value.model !== null && typeof value.model !== 'string') return null
  if (value.corpusVersion !== null && typeof value.corpusVersion !== 'string') return null
  return {
    schemaVersion: 2, answerV2, provider: value.provider, model: value.model, degraded: value.degraded,
    promptVersion: value.promptVersion, corpusVersion: value.corpusVersion, generatedAt: value.generatedAt,
  }
}

function answer(value: unknown): AnswerV2 | null {
  if (!record(value) || typeof value.status !== 'string' || !STATUSES.includes(value.status as AnswerV2Status)) return null
  if (!bounded(value.summary, 2400) || !bounded(value.interpretation, 2400) || !bounded(value.application, 2400) || !bounded(value.boundary, 2400) || !bounded(value.reflection, 2400)) return null
  if (!Array.isArray(value.actions) || value.actions.length > 2 || !value.actions.every(item => bounded(item, 2400))) return null
  if (!Array.isArray(value.citations) || value.citations.length > 3) return null
  const citations: AnswerCitationV2[] = []
  for (const item of value.citations) {
    if (!record(item)) return null
    const chapter = item.chapter
    if (typeof item.chunk_id !== 'string' || typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1 || chapter > 81 || !bounded(item.quote, 2400) || !bounded(item.explanation, 2400)) return null
    citations.push({ chunk_id: item.chunk_id, chapter, quote: item.quote, explanation: item.explanation })
  }
  return {
    status: value.status as AnswerV2Status, summary: value.summary, citations, interpretation: value.interpretation,
    application: value.application, boundary: value.boundary, actions: [...value.actions], reflection: value.reflection,
  }
}

function bounded(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length <= maximum
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
