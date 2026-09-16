import { beforeEach, describe, expect, it, vi } from 'vitest'

const openAIState = vi.hoisted(() => {
  process.env.AGNES_API_KEY = 'test-agnes-key'
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key'
  delete process.env.AGNES_BASE_URL
  delete process.env.DEEPSEEK_BASE_URL

  return {
    constructorOptions: [] as Array<Record<string, unknown>>,
    create: vi.fn(),
  }
})

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: openAIState.create } }

    constructor(options: Record<string, unknown>) {
      openAIState.constructorOptions.push(options)
    }
  },
}))

import { EmptyResponseError, FormatError, NetworkError, ProviderFailure, RateLimitedError, TimeoutError, classifyAgnesFailure, normalizeModelFailure } from '../callModel'

beforeEach(() => {
  openAIState.constructorOptions.length = 0
  openAIState.create.mockReset()
  openAIState.create.mockResolvedValue({ choices: [{ message: { content: '{"answer":"ok"}' } }] })
})

describe('callModel provider requests', () => {
  it('calls the Agnes OpenAI-compatible API with JSON-object output enabled', async () => {
    const { callModel } = await import('../callModel')

    await callModel('agnes', [{ role: 'user', content: 'test' }])

    expect(openAIState.constructorOptions[0]).toMatchObject({
      baseURL: 'https://apihub.agnes-ai.com/v1',
      maxRetries: 0,
    })
    expect(openAIState.create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'agnes-2.0-flash',
      response_format: { type: 'json_object' },
    }))
  })

  it('does not change the existing DeepSeek request format', async () => {
    const { callModel } = await import('../callModel')

    await callModel('deepseek', [{ role: 'user', content: 'test' }])

    expect(openAIState.create).toHaveBeenCalledWith(expect.not.objectContaining({
      response_format: expect.anything(),
    }))
  })
})

describe('normalizeModelFailure', () => {
  it.each([
    new Error('Request timed out.'),
    new Error('request timeout'),
    new Error('The request was aborted.'),
    Object.assign(new Error('connection failed'), { code: 'ETIMEDOUT' }),
    Object.assign(new Error('connection failed'), { name: 'APIConnectionTimeoutError' }),
  ])('normalizes provider timeout variant %#', failure => {
    expect(normalizeModelFailure(failure, 'agnes', 8000)).toBeInstanceOf(TimeoutError)
  })

  it('keeps rate limiting and format errors distinct from a timeout', () => {
    expect(normalizeModelFailure(Object.assign(new Error('too many requests'), { status: 429 }), 'agnes', 8000)).toBeInstanceOf(RateLimitedError)
    const format = new FormatError('malformed JSON')
    expect(normalizeModelFailure(format, 'agnes', 8000)).toBe(format)
  })

  it('keeps a network closure out of the timeout category and classifies it distinctly', () => {
    const failure = normalizeModelFailure(new Error('socket closed'), 'agnes', 8000)
    expect(failure).not.toBeInstanceOf(TimeoutError)
    expect(failure).toBeInstanceOf(NetworkError)
  })

  it('keeps authorization and empty-response diagnostics distinct without secrets', () => {
    const unauthorized = normalizeModelFailure(Object.assign(new Error('not authorized'), { status: 401 }), 'agnes', 8000)
    expect(unauthorized).toBeInstanceOf(ProviderFailure)
    expect(classifyAgnesFailure(unauthorized)).toBe('unauthorized')
    expect(classifyAgnesFailure(new EmptyResponseError('agnes'))).toBe('empty')
    expect(unauthorized.message).not.toMatch(/key|token/i)
  })

  it('reads Retry-After expressed as integer seconds', () => {
    const failure = normalizeModelFailure({
      status: 429,
      headers: { get: () => '12' },
    }, 'agnes', 8000)

    expect(failure).toBeInstanceOf(RateLimitedError)
    expect((failure as RateLimitedError).retryAfterSeconds).toBe(12)
  })

  it('reads Retry-After expressed as an HTTP date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T00:00:00.000Z'))

    try {
      const failure = normalizeModelFailure({
        status: 429,
        headers: { get: () => 'Wed, 16 Sep 2026 00:00:09 GMT' },
      }, 'agnes', 8000)

      expect(failure).toBeInstanceOf(RateLimitedError)
      expect((failure as RateLimitedError).retryAfterSeconds).toBe(9)
    } finally {
      vi.useRealTimers()
    }
  })
})
