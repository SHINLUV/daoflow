import {
  callModel,
  classifyAgnesFailure,
  getProviderMetadata,
  retryAfterSeconds,
  type AgnesFailureKind,
  type ChatMessage,
} from './callModel'
import { parseAndValidateAnswerV2, type AnswerV2 } from './answerV2'
import { buildDaoAnswerMessages, DAO_ANSWER_PROMPT_VERSION } from './prompt'
import { retrieveApprovedLexically } from '../rag/approvedLexical'
import type { ApprovedCorpusRepository, RetrievalEvidence, RetrievalResult } from '../rag/types'

export interface AgnesAttempt {
  attempt: number
  provider: 'agnes'
  outcome: 'succeeded' | 'failed'
  failureKind?: AgnesFailureKind
  httpStatus?: number
  latencyMs: number
  retryAfterSeconds?: number
  at: string
}

export interface AgnesAnswerSuccess {
  kind: 'success'
  provider: 'agnes'
  model: string
  degraded: false
  answer: AnswerV2
  evidence: RetrievalEvidence[]
  corpusVersion: string
  promptVersion: typeof DAO_ANSWER_PROMPT_VERSION
  attempts: AgnesAttempt[]
}

export interface InsufficientEvidenceResult {
  kind: 'insufficient_evidence'
  provider: 'none'
  model: null
  degraded: false
  answer: AnswerV2
  corpusVersion: string | null
  promptVersion: typeof DAO_ANSWER_PROMPT_VERSION
  attempts: AgnesAttempt[]
  reason: string
}

export interface AgnesUnavailableResult {
  kind: 'unavailable'
  provider: 'none'
  model: null
  degraded: true
  promptVersion: typeof DAO_ANSWER_PROMPT_VERSION
  corpusVersion: string | null
  attempts: AgnesAttempt[]
  failureKind: AgnesFailureKind
  retryAfterSeconds: number | null
}

export type DaoAnswerGenerationResult = AgnesAnswerSuccess | InsufficientEvidenceResult | AgnesUnavailableResult

export interface GenerateDaoAnswerDependencies {
  corpusRepository: ApprovedCorpusRepository
  callAgnes?: (messages: ChatMessage[], timeoutMs: number) => Promise<string>
  now?: () => Date
  sleep?: (milliseconds: number) => Promise<void>
  random?: () => number
  retrieve?: (question: string, repository: ApprovedCorpusRepository, limit: number) => Promise<RetrievalResult>
}

// Agnes may spend tens of seconds reasoning before it emits the final JSON.
// Keep enough room for one paced retry without treating a slow real response
// as unavailable or immediately colliding with the provider capacity pool.
const CANDIDATE_TIMEOUT_MS = 60_000
const TOTAL_GENERATION_BUDGET_MS = 140_000
const MAX_AGNES_ATTEMPTS = 2
const AGNES_RETRY_BACKOFF_MS = 15_000

/**
 * The only v2 generation path. It never invokes DeepSeek or a static chapter
 * fallback, and it returns `provider: none` whenever no actual Agnes response
 * has passed the server-side schema and citation proof.
 */
export async function generateDaoAnswerV2(
  question: string,
  dependencies: GenerateDaoAnswerDependencies,
): Promise<DaoAnswerGenerationResult> {
  const retrieve = dependencies.retrieve ?? retrieveApprovedLexically
  const retrieval = await retrieve(question, dependencies.corpusRepository, 5)
  if (retrieval.kind !== 'evidence') return insufficientEvidence(retrieval)

  const now = dependencies.now ?? (() => new Date())
  const sleep = dependencies.sleep ?? (milliseconds => new Promise<void>(resolve => setTimeout(resolve, milliseconds)))
  const random = dependencies.random ?? Math.random
  const callAgnes = dependencies.callAgnes ?? defaultCallAgnes
  const metadata = getProviderMetadata('agnes')
  let messages = buildDaoAnswerMessages(question, retrieval.evidence)
  const attempts: AgnesAttempt[] = []
  const startedAt = now().getTime()
  let failureKind: AgnesFailureKind = 'unknown'
  let retryAfter: number | null = null

  for (let attempt = 1; attempt <= MAX_AGNES_ATTEMPTS; attempt += 1) {
    const remaining = TOTAL_GENERATION_BUDGET_MS - (now().getTime() - startedAt)
    if (remaining <= 0) break
    const timeoutMs = Math.min(CANDIDATE_TIMEOUT_MS, remaining)
    const attemptStarted = now()
    try {
      const raw = await callAgnes(messages, timeoutMs)
      const answer = parseAndValidateAnswerV2(raw, retrieval.evidence)
      attempts.push({
        attempt,
        provider: 'agnes',
        outcome: 'succeeded',
        latencyMs: Math.max(0, now().getTime() - attemptStarted.getTime()),
        at: attemptStarted.toISOString(),
      })
      return {
        kind: 'success',
        provider: 'agnes',
        model: metadata.model,
        degraded: false,
        answer,
        evidence: retrieval.evidence,
        corpusVersion: retrieval.corpusVersion,
        promptVersion: DAO_ANSWER_PROMPT_VERSION,
        attempts,
      }
    } catch (error) {
      failureKind = generationFailureKind(error)
      retryAfter = retryAfterSeconds(error)
      attempts.push({
        attempt,
        provider: 'agnes',
        outcome: 'failed',
        failureKind,
        httpStatus: httpStatus(error),
        latencyMs: Math.max(0, now().getTime() - attemptStarted.getTime()),
        ...(retryAfter === null ? {} : { retryAfterSeconds: retryAfter }),
        at: attemptStarted.toISOString(),
      })
      if (!retryAllowed(failureKind, attempt)) break

      if (repairableModelOutput(failureKind)) {
        messages = [...messages, modelOutputCorrection(failureKind)]
      }

      const waitMs = retryDelayMilliseconds(failureKind, retryAfter, random)
      const remainingAfterFailure = TOTAL_GENERATION_BUDGET_MS - (now().getTime() - startedAt)
      if (waitMs >= remainingAfterFailure) break
      await sleep(waitMs)
    }
  }

  return {
    kind: 'unavailable',
    provider: 'none',
    model: null,
    degraded: true,
    promptVersion: DAO_ANSWER_PROMPT_VERSION,
    corpusVersion: retrieval.corpusVersion,
    attempts,
    failureKind,
    retryAfterSeconds: retryAfter,
  }
}

function repairableModelOutput(kind: AgnesFailureKind): boolean {
  return kind === 'invalid_json' || kind === 'invalid_citation' || kind === 'format_error'
}

function modelOutputCorrection(kind: AgnesFailureKind): ChatMessage {
  return {
    role: 'user',
    content: `上一份输出未通过服务器校验（${kind}）。请重新生成：只输出一个 JSON 对象；citations.quote 必须直接复制 evidence.text 的连续原文，保留繁简体、异体字和原标点，不得翻译、转写或改写；正文总长度不超过 1200 字。`,
  }
}

function defaultCallAgnes(messages: ChatMessage[], timeoutMs: number): Promise<string> {
  return callModel('agnes', messages, { timeout: timeoutMs, temperature: 0.2, maxTokens: 2400 })
}

function insufficientEvidence(retrieval: Exclude<RetrievalResult, { kind: 'evidence' }>): InsufficientEvidenceResult {
  const configuration = retrieval.kind === 'configuration_error'
  return {
    kind: 'insufficient_evidence',
    provider: 'none',
    model: null,
    degraded: false,
    corpusVersion: retrieval.corpusVersion,
    promptVersion: DAO_ANSWER_PROMPT_VERSION,
    attempts: [],
    reason: retrieval.kind === 'configuration_error' ? retrieval.reason : retrieval.reason,
    // This is an explicit, non-AI evidence state. No static chapter is selected.
    answer: {
      status: 'insufficient_evidence',
      summary: configuration ? '可信经典语料配置暂不可用，暂不生成带出处的解读。' : '当前没有可用的已审核经典片段，暂不强行匹配章节。',
      citations: [],
      interpretation: '',
      application: '',
      boundary: '',
      actions: [],
      reflection: '你愿意补充一下此刻最难判断的处境、选择或担心吗？',
    },
  }
}

function generationFailureKind(error: unknown): AgnesFailureKind {
  const status = httpStatus(error)
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 429) return 'rate_limited'
  if (status && status >= 500 && status <= 599) return 'server'
  const classified = classifyAgnesFailure(error)
  if (classified !== 'format_error') return classified
  if (error instanceof Error && /精确片段|章节不匹配|approved evidence/.test(error.message)) return 'invalid_citation'
  if (error instanceof Error && /不是合法 JSON|唯一合法 JSON/.test(error.message)) return 'invalid_json'
  return 'format_error'
}

function retryAllowed(kind: AgnesFailureKind, attempt: number): boolean {
  if (attempt >= MAX_AGNES_ATTEMPTS) return false
  return kind === 'rate_limited' || kind === 'timeout' || kind === 'network' || kind === 'server' || kind === 'empty' || kind === 'invalid_json' || kind === 'invalid_citation' || kind === 'format_error'
}

function retryDelayMilliseconds(kind: AgnesFailureKind, retryAfter: number | null, random: () => number): number {
  if (kind === 'rate_limited' && retryAfter !== null) return retryAfter * 1000 + Math.floor(random() * 250)
  return AGNES_RETRY_BACKOFF_MS + Math.floor(random() * 250)
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const candidates = [
    'statusCode' in error ? error.statusCode : undefined,
    'status' in error ? error.status : undefined,
  ]
  return candidates.find((candidate): candidate is number => (
    typeof candidate === 'number'
    && Number.isInteger(candidate)
    && candidate >= 100
    && candidate <= 599
  ))
}
