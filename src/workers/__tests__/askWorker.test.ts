import { describe, expect, it, vi } from 'vitest'
import { runAskWorkerOnce, type AskWorkerGateway } from '../askWorker'
import { DAO_ANSWER_PROMPT_VERSION } from '../../lib/ai/prompt'

const job = { requestId: 'r-1', userId: 'u-1', question: '关系边界', claimToken: 'claim', generation: 1, sourceEntryId: null, volumeId: null }
const answer = { status: 'insufficient_evidence' as const, summary: '暂无证据。', citations: [], interpretation: '', application: '', boundary: '', actions: [], reflection: '能补充处境吗？' }

function gateway(): AskWorkerGateway {
  return {
    claimOne: vi.fn().mockResolvedValue(job), heartbeat: vi.fn().mockResolvedValue(true), completeGenerated: vi.fn().mockResolvedValue('generated'), saveGenerated: vi.fn().mockResolvedValue('saved'), markFailed: vi.fn().mockResolvedValue('failed'),
  }
}

describe('persistent ask worker domain tick', () => {
  it('writes a validated generated snapshot before its separate save operation', async () => {
    const db = gateway()
    const result = await runAskWorkerOnce('worker-a', { gateway: db, generate: vi.fn().mockResolvedValue({ kind: 'insufficient_evidence', provider: 'none', model: null, degraded: false, answer, corpusVersion: null, promptVersion: DAO_ANSWER_PROMPT_VERSION, attempts: [], reason: 'CORPUS_NOT_ELIGIBLE' }) })
    expect(result).toEqual({ kind: 'saved', requestId: 'r-1' })
    expect(db.completeGenerated).toHaveBeenCalledWith(expect.objectContaining({ claimToken: 'claim', generation: 1 }), expect.objectContaining({ schemaVersion: 2 }))
    expect(db.saveGenerated).toHaveBeenCalledWith(expect.objectContaining({ claimToken: 'claim', generation: 1 }))
  })

  it('records a provider failure without manufacturing an answer', async () => {
    const db = gateway()
    const result = await runAskWorkerOnce('worker-a', { gateway: db, generate: vi.fn().mockResolvedValue({ kind: 'unavailable', provider: 'none', model: null, degraded: true, promptVersion: DAO_ANSWER_PROMPT_VERSION, corpusVersion: 'wb-v1', attempts: [], failureKind: 'timeout', retryAfterSeconds: null }) })
    expect(result).toEqual({ kind: 'failed', requestId: 'r-1', code: 'timeout' })
    expect(db.completeGenerated).not.toHaveBeenCalled()
    expect(db.markFailed).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'r-1' }), expect.objectContaining({ code: 'timeout' }))
  })

  it('heartbeats a claimed lease using its claim token and generation before completion', async () => {
    const db = gateway()
    const calls: string[] = []
    const generationResult = { kind: 'insufficient_evidence' as const, provider: 'none' as const, model: null, degraded: false as const, answer, corpusVersion: null, promptVersion: DAO_ANSWER_PROMPT_VERSION as typeof DAO_ANSWER_PROMPT_VERSION, attempts: [], reason: 'CORPUS_NOT_ELIGIBLE' }
    let releaseGeneration!: () => void
    const pendingGeneration = new Promise<typeof generationResult>(resolve => {
      releaseGeneration = () => resolve(generationResult)
    })
    db.heartbeat = vi.fn().mockImplementation(async claimedJob => {
      calls.push('heartbeat')
      expect(claimedJob).toMatchObject({ claimToken: 'claim', generation: 1 })
      releaseGeneration()
      return true
    })
    db.completeGenerated = vi.fn().mockImplementation(async () => {
      calls.push('complete')
      return 'generated'
    })
    db.saveGenerated = vi.fn().mockImplementation(async () => {
      calls.push('save')
      return 'saved'
    })

    const result = await runAskWorkerOnce('worker-a', {
      gateway: db,
      heartbeatMs: 1,
      leaseSeconds: 75,
      generate: () => pendingGeneration,
    })
    expect(result).toEqual({ kind: 'saved', requestId: 'r-1' })
    expect(db.heartbeat).toHaveBeenCalledWith(expect.objectContaining({ claimToken: 'claim', generation: 1 }), 75)
    expect(db.completeGenerated).toHaveBeenCalledWith(expect.objectContaining({ claimToken: 'claim', generation: 1 }), expect.objectContaining({ schemaVersion: 2 }))
    expect(calls).toEqual(['heartbeat', 'complete', 'save'])
  })

  it('does not complete after an in-flight heartbeat reports its claim stale', async () => {
    const db = gateway()
    let heartbeatStarted!: () => void
    const heartbeatHasStarted = new Promise<void>(resolve => { heartbeatStarted = resolve })
    let resolveHeartbeat!: (ok: boolean) => void
    const heartbeatResult = new Promise<boolean>(resolve => { resolveHeartbeat = resolve })
    let resolveGeneration!: (result: { kind: 'insufficient_evidence'; provider: 'none'; model: null; degraded: false; answer: typeof answer; corpusVersion: null; promptVersion: typeof DAO_ANSWER_PROMPT_VERSION; attempts: []; reason: string }) => void
    const pendingGeneration = new Promise<{ kind: 'insufficient_evidence'; provider: 'none'; model: null; degraded: false; answer: typeof answer; corpusVersion: null; promptVersion: typeof DAO_ANSWER_PROMPT_VERSION; attempts: []; reason: string }>(resolve => { resolveGeneration = resolve })
    db.heartbeat = vi.fn().mockImplementation(() => {
      heartbeatStarted()
      return heartbeatResult
    })

    const running = runAskWorkerOnce('worker-a', {
      gateway: db,
      heartbeatMs: 1,
      generate: () => pendingGeneration,
    })
    await heartbeatHasStarted
    resolveGeneration({ kind: 'insufficient_evidence', provider: 'none', model: null, degraded: false, answer, corpusVersion: null, promptVersion: DAO_ANSWER_PROMPT_VERSION, attempts: [], reason: 'CORPUS_NOT_ELIGIBLE' })
    resolveHeartbeat(false)

    await expect(running).resolves.toEqual({ kind: 'stale', requestId: 'r-1' })
    expect(db.completeGenerated).not.toHaveBeenCalled()
    expect(db.saveGenerated).not.toHaveBeenCalled()
  })

  it('does not start overlapping heartbeats while the prior heartbeat is unresolved', async () => {
    vi.useFakeTimers()
    try {
      const db = gateway()
      const generationResult = { kind: 'insufficient_evidence' as const, provider: 'none' as const, model: null, degraded: false as const, answer, corpusVersion: null, promptVersion: DAO_ANSWER_PROMPT_VERSION as typeof DAO_ANSWER_PROMPT_VERSION, attempts: [], reason: 'CORPUS_NOT_ELIGIBLE' }
      let releaseGeneration!: () => void
      const pendingGeneration = new Promise<typeof generationResult>(resolve => { releaseGeneration = () => resolve(generationResult) })
      let releaseHeartbeat!: (ok: boolean) => void
      const pendingHeartbeat = new Promise<boolean>(resolve => { releaseHeartbeat = resolve })
      db.heartbeat = vi.fn().mockImplementation(() => pendingHeartbeat)

      const running = runAskWorkerOnce('worker-a', {
        gateway: db,
        heartbeatMs: 1,
        generate: () => pendingGeneration,
      })
      await vi.advanceTimersByTimeAsync(5)
      expect(db.heartbeat).toHaveBeenCalledTimes(1)

      releaseHeartbeat(true)
      releaseGeneration()
      await expect(running).resolves.toEqual({ kind: 'saved', requestId: 'r-1' })
    } finally {
      vi.useRealTimers()
    }
  })
})
