import type { AgnesAttempt, DaoAnswerGenerationResult } from '../lib/ai/generateAnswerV2'
import type { AnswerV2 } from '../lib/ai/answerV2'

export const ASK_WORKER_HEARTBEAT_MS = 15_000
export const ASK_WORKER_LEASE_SECONDS = 75

export interface ClaimedAskJob {
  requestId: string
  userId: string
  question: string
  claimToken: string
  generation: number
  sourceEntryId: string | null
  volumeId: string | null
}

export interface GeneratedAskSnapshot {
  schemaVersion: 2
  answerV2: AnswerV2
  provider: 'agnes' | 'none'
  model: string | null
  degraded: boolean
  promptVersion: string
  corpusVersion: string | null
  generatedAt: string
  attempts: AgnesAttempt[]
}

export interface AskWorkerGateway {
  claimOne(workerId: string, leaseSeconds: number): Promise<ClaimedAskJob | null>
  heartbeat(job: Pick<ClaimedAskJob, 'requestId' | 'claimToken' | 'generation'>, leaseSeconds: number): Promise<boolean>
  completeGenerated(job: Pick<ClaimedAskJob, 'requestId' | 'userId' | 'claimToken' | 'generation'>, snapshot: GeneratedAskSnapshot): Promise<'generated' | 'stale'>
  saveGenerated?(job: Pick<ClaimedAskJob, 'requestId' | 'userId' | 'claimToken' | 'generation'>): Promise<'saved' | 'generated' | 'stale'>
  markFailed(job: Pick<ClaimedAskJob, 'requestId' | 'userId' | 'claimToken' | 'generation'>, failure: WorkerFailure): Promise<'failed' | 'stale'>
}

export interface WorkerFailure {
  code: string
  retryAfterSeconds: number | null
  attempts: AgnesAttempt[]
}

export interface AskWorkerDependencies {
  gateway: AskWorkerGateway
  generate: (job: ClaimedAskJob) => Promise<DaoAnswerGenerationResult>
  now?: () => Date
  heartbeatMs?: number
  leaseSeconds?: number
}

export type AskWorkerRunResult =
  | { kind: 'idle' }
  | { kind: 'saved' | 'generated' | 'stale'; requestId: string }
  | { kind: 'failed' | 'failure_write_stale'; requestId: string; code: string }

/**
 * One lease-fenced worker tick. Routes must only enqueue; they must never call
 * this as an unawaited background promise. Every completion RPC receives the
 * claim token and generation so an expired worker cannot write a newer claim.
 */
export async function runAskWorkerOnce(workerId: string, dependencies: AskWorkerDependencies): Promise<AskWorkerRunResult> {
  const leaseSeconds = dependencies.leaseSeconds ?? ASK_WORKER_LEASE_SECONDS
  const heartbeatMs = dependencies.heartbeatMs ?? ASK_WORKER_HEARTBEAT_MS
  const job = await dependencies.gateway.claimOne(workerId, leaseSeconds)
  if (!job) return { kind: 'idle' }

  let heartbeatStopped = false
  let heartbeatInFlight: Promise<void> | null = null
  const interval = setInterval(() => {
    if (heartbeatInFlight) return
    const pendingHeartbeat = dependencies.gateway.heartbeat(job, leaseSeconds).then(ok => {
      if (!ok) heartbeatStopped = true
    }).catch(() => {
      heartbeatStopped = true
    })
    heartbeatInFlight = pendingHeartbeat
    void pendingHeartbeat.finally(() => {
      if (heartbeatInFlight === pendingHeartbeat) heartbeatInFlight = null
    })
  }, heartbeatMs)

  async function stopHeartbeats(): Promise<void> {
    clearInterval(interval)
    const pendingHeartbeat = heartbeatInFlight
    await pendingHeartbeat
  }

  try {
    const result = await dependencies.generate(job)
    await stopHeartbeats()
    if (heartbeatStopped) return { kind: 'stale', requestId: job.requestId }
    if (result.kind === 'unavailable') {
      const failed = await dependencies.gateway.markFailed(job, {
        code: result.failureKind,
        retryAfterSeconds: result.retryAfterSeconds,
        attempts: result.attempts,
      })
      return failed === 'stale'
        ? { kind: 'failure_write_stale', requestId: job.requestId, code: result.failureKind }
        : { kind: 'failed', requestId: job.requestId, code: result.failureKind }
    }

    const snapshot = toGeneratedSnapshot(result, dependencies.now ?? (() => new Date()))
    const completed = await dependencies.gateway.completeGenerated(job, snapshot)
    if (completed === 'stale' || heartbeatStopped) return { kind: 'stale', requestId: job.requestId }
    if (!dependencies.gateway.saveGenerated) return { kind: 'generated', requestId: job.requestId }
    const saved = await dependencies.gateway.saveGenerated(job)
    return { kind: saved === 'saved' ? 'saved' : saved === 'stale' ? 'stale' : 'generated', requestId: job.requestId }
  } catch {
    await stopHeartbeats()
    if (heartbeatStopped) return { kind: 'failure_write_stale', requestId: job.requestId, code: 'worker_internal_error' }
    const failed = await dependencies.gateway.markFailed(job, { code: 'worker_internal_error', retryAfterSeconds: null, attempts: [] })
    return failed === 'stale'
      ? { kind: 'failure_write_stale', requestId: job.requestId, code: 'worker_internal_error' }
      : { kind: 'failed', requestId: job.requestId, code: 'worker_internal_error' }
  } finally {
    clearInterval(interval)
  }
}

export function toGeneratedSnapshot(result: Exclude<DaoAnswerGenerationResult, { kind: 'unavailable' }>, now: () => Date): GeneratedAskSnapshot {
  return {
    schemaVersion: 2,
    answerV2: result.answer,
    provider: result.provider,
    model: result.model,
    degraded: result.degraded,
    promptVersion: result.promptVersion,
    corpusVersion: result.corpusVersion,
    generatedAt: now().toISOString(),
    attempts: result.attempts,
  }
}
