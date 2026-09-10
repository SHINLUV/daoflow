import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { generateDaoAnswerV2, type AgnesAttempt } from '@/lib/ai/generateAnswerV2'
import { anonymousAiIpSubject } from '@/lib/auth/rateLimit'
import type { CorpusChunkRecord, CorpusRuntimePolicy, ApprovedCorpusRepository } from '@/lib/rag/types'
import {
  runAskWorkerOnce,
  type AskWorkerGateway,
  type ClaimedAskJob,
  type GeneratedAskSnapshot,
  type WorkerFailure,
} from '@/workers/askWorker'

type Json = Record<string, unknown>

export function hasAskWorkerConfiguration(): boolean {
  const configuredWorkerId = process.env.DAOFLOW_ASK_WORKER_ID
  return Boolean((process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
    && process.env.SUPABASE_SERVICE_ROLE_KEY
    && (!configuredWorkerId || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configuredWorkerId)))
}

/** The public queue is unavailable until its separately deployed runner can authenticate back to this app. */
export function hasAskWorkerRunnerConfiguration(): boolean {
  return hasAskWorkerConfiguration() && Boolean(process.env.DAOFLOW_ASK_WORKER_TOKEN && process.env.DAOFLOW_ASK_WORKER_TOKEN.length >= 32)
}

export function workerIdentifier(): string {
  return process.env.DAOFLOW_ASK_WORKER_ID || crypto.randomUUID()
}

export function createConfiguredCorpusRepository(): ApprovedCorpusRepository | null {
  const client = serviceClient()
  return client ? createCorpusRepository(client) : null
}

export async function reserveAnonymousAsk(request: NextRequest): Promise<{ leaseId: string } | null> {
  const subject = anonymousAiIpSubject(request)
  const client = serviceClient()
  if (!subject || !client) return null
  const { data, error } = await client.rpc('reserve_anonymous_ask', { p_ip_subject: subject })
  if (error || !record(data) || typeof data.leaseId !== 'string') throw new Error(error?.message ?? 'ANONYMOUS_LIMIT_RESPONSE_INVALID')
  return { leaseId: data.leaseId }
}

export async function releaseAnonymousAsk(leaseId: string): Promise<void> {
  const client = serviceClient()
  if (!client) return
  await client.rpc('release_anonymous_ask', { p_lease_id: leaseId })
}

export async function runConfiguredAskWorkerOnce(workerId = workerIdentifier()) {
  const client = serviceClient()
  if (!client) throw new Error('ASK_WORKER_UNAVAILABLE')
  const repository = createCorpusRepository(client)
  return runAskWorkerOnce(workerId, {
    gateway: createGateway(client),
    generate: job => generateDaoAnswerV2(job.question, { corpusRepository: repository }),
  })
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function createCorpusRepository(client: SupabaseClient): ApprovedCorpusRepository {
  const corpusVersion = process.env.DAOFLOW_CORPUS_VERSION ?? 'dao-de-jing-wang-bi-v1'
  return {
    async getRuntimePolicy(): Promise<CorpusRuntimePolicy> {
      const { data, error } = await client.from('dao_corpus_versions')
        .select('corpus_version,review_status')
        .eq('corpus_version', corpusVersion)
        .maybeSingle()
      if (error || !data) return { eligibility: 'configuration_error', corpusVersion: null, reason: 'CORPUS_VERSION_UNAVAILABLE' }
      if (data.review_status !== 'approved') return { eligibility: 'not_eligible', corpusVersion, reason: 'CORPUS_NOT_INDEPENDENTLY_APPROVED' }
      return { eligibility: 'eligible', corpusVersion, reason: 'APPROVED' }
    },
    async listChunksForLexicalRetrieval(version: string): Promise<CorpusChunkRecord[]> {
      const { data, error } = await client.from('dao_corpus_chunks')
        .select('chunk_id,chapter,paragraph,content,edition,kind,review_status,corpus_version,source_revision,source_url,license,theme_terms')
        .eq('corpus_version', version)
        .eq('review_status', 'approved')
        .order('chapter', { ascending: true })
        .order('chunk_id', { ascending: true })
      if (error) throw new Error('APPROVED_CORPUS_READ_FAILED')
      return (data ?? []).flatMap(row => toChunk(row))
    },
  }
}

function toChunk(value: unknown): CorpusChunkRecord[] {
  if (!record(value)
    || typeof value.chunk_id !== 'string' || typeof value.chapter !== 'number' || typeof value.content !== 'string'
    || typeof value.edition !== 'string' || typeof value.kind !== 'string' || typeof value.review_status !== 'string'
    || typeof value.corpus_version !== 'string' || typeof value.source_revision !== 'string' || typeof value.source_url !== 'string'
    || typeof value.license !== 'string' || !Array.isArray(value.theme_terms)) return []
  if (value.kind !== 'original' && value.kind !== 'translation' && value.kind !== 'annotation') return []
  if (value.review_status !== 'approved' || value.theme_terms.some(term => typeof term !== 'string')) return []
  return [{
    chunkId: value.chunk_id, chapter: value.chapter, paragraph: typeof value.paragraph === 'number' ? value.paragraph : null,
    text: value.content, edition: value.edition, kind: value.kind, reviewStatus: 'approved', corpusVersion: value.corpus_version,
    sourceRevision: value.source_revision, sourceUrl: value.source_url, license: value.license, themeTerms: value.theme_terms,
  }]
}

function createGateway(client: SupabaseClient): AskWorkerGateway {
  return {
    async claimOne(workerId, leaseSeconds) {
      const { data, error } = await client.rpc('claim_next_ask_worker_job', { p_worker_id: workerId, p_lease_seconds: leaseSeconds })
      if (error) throw new Error('ASK_WORKER_CLAIM_FAILED')
      return toClaim(data)
    },
    async heartbeat(job, leaseSeconds) {
      const { data, error } = await client.rpc('heartbeat_ask_worker_job', {
        p_request_id: job.requestId, p_claim_token: job.claimToken, p_generation: job.generation, p_lease_seconds: leaseSeconds,
      })
      if (error) throw new Error('ASK_WORKER_HEARTBEAT_FAILED')
      return data === true
    },
    async completeGenerated(job, snapshot) {
      const result = await workerRpc(client, 'complete_ask_worker_generation', {
        p_user_id: job.userId, p_request_id: job.requestId, p_claim_token: job.claimToken, p_generation: job.generation, p_snapshot: snapshot,
      })
      return result.stale === true ? 'stale' : result.state === 'generated' ? 'generated' : 'stale'
    },
    async saveGenerated(job) {
      const result = await workerRpc(client, 'save_ask_worker_generation', {
        p_user_id: job.userId, p_request_id: job.requestId, p_claim_token: job.claimToken, p_generation: job.generation,
      })
      return result.stale === true ? 'stale' : result.state === 'saved' ? 'saved' : 'generated'
    },
    async markFailed(job, failure) {
      const result = await workerRpc(client, 'fail_ask_worker_generation', {
        p_user_id: job.userId, p_request_id: job.requestId, p_claim_token: job.claimToken, p_generation: job.generation,
        p_failure_code: failure.code, p_retry_after_seconds: failure.retryAfterSeconds, p_attempts: failure.attempts,
      })
      return result.stale === true ? 'stale' : 'failed'
    },
  }
}

async function workerRpc(client: SupabaseClient, name: string, args: Json): Promise<Json> {
  const { data, error } = await client.rpc(name, args)
  if (error || !record(data)) throw new Error(`ASK_WORKER_${name.toUpperCase()}_FAILED`)
  return data
}

function toClaim(value: unknown): ClaimedAskJob | null {
  if (value === null) return null
  if (!record(value)
    || typeof value.requestId !== 'string' || typeof value.userId !== 'string' || typeof value.question !== 'string'
    || typeof value.claimToken !== 'string' || typeof value.generation !== 'number') throw new Error('ASK_WORKER_CLAIM_INVALID')
  return {
    requestId: value.requestId, userId: value.userId, question: value.question, claimToken: value.claimToken,
    generation: value.generation, sourceEntryId: typeof value.sourceEntryId === 'string' ? value.sourceEntryId : null,
    volumeId: typeof value.volumeId === 'string' ? value.volumeId : null,
  }
}

function record(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type { AgnesAttempt, GeneratedAskSnapshot, WorkerFailure }
