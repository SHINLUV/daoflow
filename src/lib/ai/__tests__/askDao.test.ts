/**
 * askDao 降级调度单元测试
 *
 * 用 mock 方式模拟:
 *   - Agnes 超时 → 落到 DeepSeek 成功
 *   - Agnes + DeepSeek 都失败 → 落到本地降级
 *   - Agnes 格式错误 → 落到 DeepSeek
 *   - Agnes 直接成功
 *   - Agnes 速率限制 → DeepSeek
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vitest: mock 模块，用 hoisted 方式声明 mock 函数
const { mockCallModel } = vi.hoisted(() => {
  return { mockCallModel: vi.fn() }
})

vi.mock('../callModel', () => ({
  callModel: mockCallModel,
  TimeoutError: class extends Error {
    constructor(msg = 'AI 调用超时') { super(msg); this.name = 'TimeoutError' }
  },
  RateLimitedError: class extends Error {
    constructor(msg = 'API 速率限制') { super(msg); this.name = 'RateLimitedError' }
  },
  FormatError: class extends Error {
    constructor(msg = 'AI 返回格式异常') { super(msg); this.name = 'FormatError' }
  },
}))

import { askDao } from '../askDao'

function successResponse(chapter = 44) {
  return JSON.stringify({
    matched_chapter: chapter,
    interpretation: '知足不辱，知止不殆。',
    follow_up_question: '你能放下什么？',
  })
}

beforeEach(() => {
  mockCallModel.mockReset()
})

describe('askDao 降级调度', () => {
  it('Agnes 正常返回', async () => {
    mockCallModel.mockResolvedValueOnce(successResponse(44))

    const result = await askDao('我最近很焦虑')

    expect(result.provider).toBe('agnes')
    expect(result.degraded).toBe(false)
    expect(result.matchedChapter).toBe(44)
    expect(mockCallModel).toHaveBeenCalledTimes(1)
  })

  it('Agnes 超时 → DeepSeek 成功', async () => {
    mockCallModel.mockRejectedValueOnce(new Error('timeout'))
    mockCallModel.mockResolvedValueOnce(successResponse(8))

    const result = await askDao('我该如何处理人际关系')

    expect(result.provider).toBe('deepseek')
    expect(result.degraded).toBe(false)
    expect(result.matchedChapter).toBe(8)
    expect(mockCallModel).toHaveBeenCalledTimes(2)
  })

  it('Agnes + DeepSeek 都失败 → 本地降级', async () => {
    mockCallModel.mockRejectedValue(new Error('timeout'))

    const result = await askDao('我很迷茫')

    expect(result.provider).toBe('local_fallback')
    expect(result.degraded).toBe(true)
    expect(result.fallbackReason).toBe('unknown')
    expect(result.matchedChapter).toBe(33) // 迷茫 → 33
    expect(result.followUpQuestion).toBeNull()
    expect(mockCallModel).toHaveBeenCalledTimes(2)
  })

  it('Agnes 格式错误 → DeepSeek 成功', async () => {
    mockCallModel.mockResolvedValueOnce('这是一段不包含 JSON 的普通回复')
    mockCallModel.mockResolvedValueOnce(successResponse(64))

    const result = await askDao('我该不该辞职')

    expect(result.provider).toBe('deepseek')
    expect(result.matchedChapter).toBe(64)
    expect(mockCallModel).toHaveBeenCalledTimes(2)
  })

  it('Agnes 返回格式错误代码块 → format_error → DeepSeek', async () => {
    mockCallModel.mockResolvedValueOnce('```json {"broken: true}```') // 非法 JSON
    mockCallModel.mockResolvedValueOnce(successResponse(44))

    const result = await askDao('焦虑')

    expect(result.provider).toBe('deepseek')
    expect(mockCallModel).toHaveBeenCalledTimes(2)
  })

  it('本地降级 — 无关键词匹配时返回默认第1章', async () => {
    mockCallModel.mockRejectedValue(new Error('timeout'))

    const result = await askDao('xyz123')

    expect(result.provider).toBe('local_fallback')
    expect(result.degraded).toBe(true)
    expect(result.matchedChapter).toBe(1)
  })

  it('本地降级 — 多关键词匹配取交集', async () => {
    mockCallModel.mockRejectedValue(new Error('timeout'))

    // '焦虑'→[44,46,12,16], '选择'→[64,2,44,63], 交集=[44]
    const result = await askDao('我对选择很焦虑')

    expect(result.provider).toBe('local_fallback')
    expect(result.matchedChapter).toBe(44)
  })
})
