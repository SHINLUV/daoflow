import { describe, expect, it, vi } from 'vitest'
import { generateDaoAnswerV2 } from '../generateAnswerV2'
import type { ApprovedCorpusRepository } from '../../rag/types'

const approvedRepository: ApprovedCorpusRepository = {
  getRuntimePolicy: vi.fn().mockResolvedValue({ eligibility: 'eligible', corpusVersion: 'wb-v1', reason: 'reviewed' }),
  listChunksForLexicalRetrieval: vi.fn().mockResolvedValue([{ chunkId: 'wb-008', chapter: 8, paragraph: null, text: '上善若水。水善利万物而不争。', edition: '王弼本', kind: 'original', reviewStatus: 'approved', corpusVersion: 'wb-v1', sourceRevision: '1', sourceUrl: 'https://example.invalid', license: 'CC BY-SA 4.0', themeTerms: ['关系 边界'] }]),
}

const pendingRepository: ApprovedCorpusRepository = {
  getRuntimePolicy: vi.fn().mockResolvedValue({ eligibility: 'not_eligible', corpusVersion: null, reason: 'manifest pending review' }),
  listChunksForLexicalRetrieval: vi.fn(),
}

function modelResponse() {
  return JSON.stringify({ status: 'answer', summary: '你在边界和关系之间犹豫。', citations: [{ chunk_id: 'wb-008', chapter: 8, quote: '水善利万物而不争', explanation: '可以先不把表达变成争胜。' }], interpretation: '不争不是不说。', application: '先说明你的具体需要。', boundary: '若有强迫或伤害，优先保护安全。', actions: ['写下一句边界表达。'], reflection: '你最希望对方理解什么？' })
}

describe('v2 Agnes generation', () => {
  it('does not call a model while the corpus manifest is not eligible', async () => {
    const callAgnes = vi.fn()
    const result = await generateDaoAnswerV2('我不知道怎样说边界', { corpusRepository: pendingRepository, callAgnes })
    expect(result).toMatchObject({ kind: 'insufficient_evidence', provider: 'none' })
    expect(callAgnes).not.toHaveBeenCalled()
  })

  it('labels only a validated Agnes response as Agnes and keeps the question out of the system message', async () => {
    const callAgnes = vi.fn().mockResolvedValue(modelResponse())
    const result = await generateDaoAnswerV2('我不知道怎样说边界', { corpusRepository: approvedRepository, callAgnes })
    expect(result).toMatchObject({ kind: 'success', provider: 'agnes', degraded: false })
    const messages = callAgnes.mock.calls[0][0]
    expect(messages[0].content).not.toContain('我不知道怎样说边界')
    expect(messages[1].content).toContain('待分析数据')
  })

  it('does not silently fall back or retry an authorization failure', async () => {
    const callAgnes = vi.fn().mockRejectedValue(Object.assign(new Error('no access'), { status: 401 }))
    const result = await generateDaoAnswerV2('我不知道怎样说边界', { corpusRepository: approvedRepository, callAgnes })
    expect(result).toMatchObject({ kind: 'unavailable', provider: 'none', failureKind: 'unauthorized' })
    expect(callAgnes).toHaveBeenCalledTimes(1)
  })

  it('classifies a statusCode-only authorization failure without retrying', async () => {
    const callAgnes = vi.fn().mockRejectedValue(Object.assign(new Error('no access'), { statusCode: 403 }))
    const result = await generateDaoAnswerV2('我不知道怎样说边界', { corpusRepository: approvedRepository, callAgnes })
    expect(result).toMatchObject({ kind: 'unavailable', provider: 'none', failureKind: 'forbidden' })
    expect(result.attempts.map(attempt => attempt.httpStatus)).toEqual([403])
    expect(callAgnes).toHaveBeenCalledTimes(1)
  })

  it('retains an upstream HTTP status in redacted attempts', async () => {
    const callAgnes = vi.fn().mockRejectedValue(Object.assign(new Error('too many requests'), { status: 429 }))
    const sleep = vi.fn().mockResolvedValue(undefined)
    const result = await generateDaoAnswerV2('我不知道怎样说边界', {
      corpusRepository: approvedRepository,
      callAgnes,
      sleep,
      random: () => 0,
    })
    expect(result).toMatchObject({ kind: 'unavailable', failureKind: 'rate_limited' })
    expect(result.attempts.map(attempt => attempt.httpStatus)).toEqual([429, 429])
    expect(sleep).toHaveBeenCalledWith(250)
  })

  it('retries an invalid citation with a bounded server-authored correction', async () => {
    const invalid = JSON.stringify({
      ...JSON.parse(modelResponse()),
      citations: [{ chunk_id: 'wb-008', chapter: 8, quote: '水善利萬物而不爭', explanation: '字形被模型改写。' }],
    })
    const callAgnes = vi.fn().mockResolvedValueOnce(invalid).mockResolvedValueOnce(modelResponse())
    const result = await generateDaoAnswerV2('我不知道怎样说边界', {
      corpusRepository: approvedRepository,
      callAgnes,
      sleep: vi.fn().mockResolvedValue(undefined),
      random: () => 0,
    })

    expect(result).toMatchObject({ kind: 'success', provider: 'agnes' })
    expect(callAgnes).toHaveBeenCalledTimes(2)
    const retryMessages = callAgnes.mock.calls[1][0]
    expect(retryMessages).toHaveLength(3)
    expect(retryMessages[2]).toMatchObject({ role: 'user' })
    expect(retryMessages[2].content).toContain('直接复制 evidence.text')
    expect(retryMessages[2].content).not.toContain('我不知道怎样说边界')
  })

  it.each([0, 700, Number.NaN])('falls back to status when statusCode is invalid (%s)', async statusCode => {
    const callAgnes = vi.fn().mockRejectedValue(Object.assign(new Error('too many requests'), { statusCode, status: 429 }))
    const result = await generateDaoAnswerV2('我不知道怎样说边界', {
      corpusRepository: approvedRepository,
      callAgnes,
      sleep: vi.fn().mockResolvedValue(undefined),
      random: () => 0,
    })

    expect(result).toMatchObject({ kind: 'unavailable', failureKind: 'rate_limited' })
    expect(result.attempts.map(attempt => attempt.httpStatus)).toEqual([429, 429])
  })
})
