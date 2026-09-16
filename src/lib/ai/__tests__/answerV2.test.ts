import { describe, expect, it } from 'vitest'
import { canonicalApprovedQuote, parseAndValidateAnswerV2, quoteMatchesEvidence } from '../answerV2'
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

  it('accepts an otherwise exact JSON markdown fence emitted by Agnes', () => {
    const parsed = parseAndValidateAnswerV2(`\n\n\`\`\`json\n${answer()}\n\`\`\``, evidence)
    expect(parsed.citations[0].chunk_id).toBe('wb-001')
  })

  it('safely extracts one JSON object when Agnes adds an explanation around it', () => {
    const parsed = parseAndValidateAnswerV2(`回答如下：\n\`\`\`json\n${answer()}\n\`\`\`\n以上是结构化结果。`, evidence)
    expect(parsed.summary).toBe('你正在权衡如何既保持边界又减少消耗。')
  })

  it('rejects ambiguous output containing more than one JSON object', () => {
    expect(() => parseAndValidateAnswerV2(`${answer()}\n备用：${answer()}`, evidence)).toThrow(/唯一.*JSON/)
  })

  it('allows only predefined whitespace and punctuation differences in quote proof', () => {
    expect(quoteMatchesEvidence('水善利万物 而不争。', evidence[0].text)).toBe(true)
    expect(quoteMatchesEvidence('水善害万物而不争', evidence[0].text)).toBe(false)
  })

  it('uses Simplified Chinese only to locate and return an exact approved Traditional Chinese span', () => {
    const source = '為之於未有，治之於未亂。合抱之木，生於毫末。聖人無為故無敗，無執故無失。'
    const canonical = canonicalApprovedQuote('为之于未有，治之于未乱。……圣人无为故无败，无执故无失。', source)

    expect(canonical).toBe('聖人無為故無敗，無執故無失')
    expect(source).toContain(canonical)
    expect(canonicalApprovedQuote('这是来源中完全不存在的伪造句子', source)).toBeNull()
  })

  it('canonicalizes a model citation before returning the validated answer', () => {
    const traditionalEvidence: RetrievalEvidence[] = [{ ...evidence[0], text: '禍兮福之所倚，福兮禍之所伏。孰知其極？' }]
    const parsed = parseAndValidateAnswerV2(answer({
      citations: [{ chunk_id: 'wb-001', chapter: 8, quote: '祸兮福之所倚，福兮祸之所伏。孰知其极？', explanation: '提醒我们承认变化。' }],
    }), traditionalEvidence)

    expect(parsed.citations[0].quote).toBe('禍兮福之所倚，福兮禍之所伏。孰知其極')
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
