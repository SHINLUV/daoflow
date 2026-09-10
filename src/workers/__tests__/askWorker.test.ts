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
})
