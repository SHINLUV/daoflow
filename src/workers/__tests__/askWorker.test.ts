import { describe, expect, it, vi } from 'vitest'
import { runAskWorkerOnce, type AskWorkerGateway } from '../askWorker'

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
    const result = await runAskWorkerOnce('worker-a', { gateway: db, generate: vi.fn().mockResolvedValue({ kind: 'insufficient_evidence', provider: 'none', model: null, degraded: false, answer, corpusVersion: null, promptVersion: 'dao-answer-v2.1', attempts: [], reason: 'CORPUS_NOT_ELIGIBLE' }) })
    expect(result).toEqual({ kind: 'saved', requestId: 'r-1' })
    expect(db.completeGenerated).toHaveBeenCalledWith(expect.objectContaining({ claimToken: 'claim', generation: 1 }), expect.objectContaining({ schemaVersion: 2 }))
    expect(db.saveGenerated).toHaveBeenCalledWith(expect.objectContaining({ claimToken: 'claim', generation: 1 }))
  })

  it('records a provider failure without manufacturing an answer', async () => {
    const db = gateway()
    const result = await runAskWorkerOnce('worker-a', { gateway: db, generate: vi.fn().mockResolvedValue({ kind: 'unavailable', provider: 'none', model: null, degraded: true, promptVersion: 'dao-answer-v2.1', corpusVersion: 'wb-v1', attempts: [], failureKind: 'timeout', retryAfterSeconds: null }) })
    expect(result).toEqual({ kind: 'failed', requestId: 'r-1', code: 'timeout' })
    expect(db.completeGenerated).not.toHaveBeenCalled()
    expect(db.markFailed).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'r-1' }), expect.objectContaining({ code: 'timeout' }))
  })

  it('heartbeats a claimed lease using its claim token and generation before completion', async () => {
    const db = gateway()
    const calls: string[] = []
    const generationResult = { kind: 'insufficient_evidence' as const, provider: 'none' as const, model: null, degraded: false as const, answer, corpusVersion: null, promptVersion: 'dao-answer-v2.1' as const, attempts: [], reason: 'CORPUS_NOT_ELIGIBLE' }
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
})
