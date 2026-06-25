/**
 * parseStructuredResponse 单元测试
 *
 * 覆盖场景:
 *   - 正常 JSON 解析
 *   - 带 markdown ```json 包裹的 JSON
 *   - 带 markdown ``` 包裹（无 json 标记）
 *   - JSON 被其他文字包围
 *   - matched_chapter 超出范围（0 / 82）
 *   - matched_chapter 不是整数
 *   - interpretation 缺失或为空
 *   - follow_up_question 不是字符串
 *   - 空输入
 */

import { describe, it, expect } from 'vitest'
import { parseStructuredResponse } from '../parseStructuredResponse'

describe('parseStructuredResponse', () => {
  it('正常 JSON 解析', () => {
    const input = JSON.stringify({
      matched_chapter: 44,
      interpretation: '知足不辱，知止不殆。你越追逐反而越失去。',
      follow_up_question: '你现在最想放下的是什么？',
    })

    const result = parseStructuredResponse(input)
    expect(result.matched_chapter).toBe(44)
    expect(result.interpretation).toBe('知足不辱，知止不殆。你越追逐反而越失去。')
    expect(result.follow_up_question).toBe('你现在最想放下的是什么？')
  })

  it('带 ```json 包裹的 JSON', () => {
    const input = `\`\`\`json
{
  "matched_chapter": 33,
  "interpretation": "知人者智，自知者明。",
  "follow_up_question": "你真的了解自己吗？"
}
\`\`\``

    const result = parseStructuredResponse(input)
    expect(result.matched_chapter).toBe(33)
    expect(result.interpretation).toBe('知人者智，自知者明。')
  })

  it('带 ``` 包裹（无 json 标记）', () => {
    const input = `\`\`\`
{
  "matched_chapter": 8,
  "interpretation": "上善若水。",
  "follow_up_question": "你能像水一样柔软吗？"
}
\`\`\``

    const result = parseStructuredResponse(input)
    expect(result.matched_chapter).toBe(8)
  })

  it('JSON 被其他文字包围', () => {
    const input = `根据你的问题，我推荐以下内容：

{
  "matched_chapter": 64,
  "interpretation": "千里之行始于足下。",
  "follow_up_question": "你愿意迈出第一步吗？"
}

希望对你有所帮助。`

    const result = parseStructuredResponse(input)
    expect(result.matched_chapter).toBe(64)
  })

  it('matched_chapter 超出范围（0）', () => {
    const input = JSON.stringify({
      matched_chapter: 0,
      interpretation: 'test',
      follow_up_question: 'test',
    })

    expect(() => parseStructuredResponse(input)).toThrow(/超出范围/)
  })

  it('matched_chapter 超出范围（82）', () => {
    const input = JSON.stringify({
      matched_chapter: 82,
      interpretation: 'test',
      follow_up_question: 'test',
    })

    expect(() => parseStructuredResponse(input)).toThrow(/超出范围/)
  })

  it('matched_chapter 不是整数', () => {
    const input = JSON.stringify({
      matched_chapter: 3.5,
      interpretation: 'test',
      follow_up_question: 'test',
    })

    expect(() => parseStructuredResponse(input)).toThrow(/不是整数/)
  })

  it('interpretation 缺失', () => {
    const input = JSON.stringify({
      matched_chapter: 1,
      follow_up_question: 'test',
    })

    expect(() => parseStructuredResponse(input)).toThrow(/interpretation/)
  })

  it('interpretation 为空字符串', () => {
    const input = JSON.stringify({
      matched_chapter: 1,
      interpretation: '',
      follow_up_question: 'test',
    })

    expect(() => parseStructuredResponse(input)).toThrow(/interpretation/)
  })

  it('follow_up_question 不是字符串', () => {
    const input = JSON.stringify({
      matched_chapter: 1,
      interpretation: 'test',
      follow_up_question: 123,
    })

    expect(() => parseStructuredResponse(input)).toThrow(/follow_up_question/)
  })

  it('空输入', () => {
    expect(() => parseStructuredResponse('')).toThrow(/为空/)
  })

  it('空白输入', () => {
    expect(() => parseStructuredResponse('   ')).toThrow(/为空/)
  })
})
