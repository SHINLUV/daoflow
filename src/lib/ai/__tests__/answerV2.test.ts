import { describe, expect, it } from 'vitest'
import { parseAndValidateAnswerV2, quoteMatchesEvidence } from '../answerV2'
import type { RetrievalEvidence } from '../../rag/types'

const evidence: RetrievalEvidence[] = [{
  chunkId: 'wb-001', chapter: 8, paragraph: null, text: '上善若水。水善利万物而不争。', edition: '王弼本', kind: 'original', reviewStatus: 'approved', corpusVersion: 'wb-v1', sourceRevision: '1', sourceUrl: 'https://example.invalid', license: 'CC BY-SA 4.0',
}]

function answer(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    status: 'answer', summary: '你正在权衡如何既保持边界又减少消耗。', citations: [{ chunk_id: 'wb-001', chapter: 8, quote: '水善利万物而不争', explanation: '它提示可以先辨别真正要守住的边界。' }], interpretation: '这里的“不争”不是放弃表达。', application: '先写下本周最需要说清的一件事。', boundary: '若存在伤害或胁迫，优先寻求现实支持。', actions: ['今天约一次十分钟的澄清对话。'], reflection: '你最不愿失去的边界是什么？', ...overrides,
  })
}

describe('AnswerV2 server validation', () => {
  it('accepts an exact quote with only approved evidence', () => {
    const parsed = parseAndValidateAnswerV2(answer(), evidence)
    expect(parsed.citations[0].chapter).toBe(8)
  })

  it('allows only predefined whitespace and punctuation differences in quote proof', () => {
    expect(quoteMatchesEvidence('水善利万物 而不争。', evidence[0].text)).toBe(true)
    expect(quoteMatchesEvidence('水善害万物而不争', evidence[0].text)).toBe(false)
  })

  it('rejects extra output fields and a fabricated chunk id', () => {
    expect(() => parseAndValidateAnswerV2(answer({ provider: 'agnes' }), evidence)).toThrow(/未知字段/)
    expect(() => parseAndValidateAnswerV2(answer({ citations: [{ chunk_id: 'fake', chapter: 8, quote: '水善利万物而不争', explanation: '伪造' }] }), evidence)).toThrow(/approved evidence/)
  })

  it('rejects an answer without citations and a quote not contained in the cited chunk', () => {
    expect(() => parseAndValidateAnswerV2(answer({ citations: [] }), evidence)).toThrow(/必须包含/)
    expect(() => parseAndValidateAnswerV2(answer({ citations: [{ chunk_id: 'wb-001', chapter: 8, quote: '不存在的古文', explanation: '伪造' }] }), evidence)).toThrow(/精确片段/)
  })

  it('bounds generated body text while not counting source quotations as model prose', () => {
    expect(() => parseAndValidateAnswerV2(answer({ interpretation: '长'.repeat(1201) }), evidence)).toThrow(/1200/)
  })
})
