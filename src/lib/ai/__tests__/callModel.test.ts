import { describe, expect, it } from 'vitest'
import { FormatError, RateLimitedError, TimeoutError, normalizeModelFailure } from '../callModel'

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

  it('keeps a genuine unknown error out of the timeout category', () => {
    const failure = normalizeModelFailure(new Error('socket closed'), 'agnes', 8000)
    expect(failure).not.toBeInstanceOf(TimeoutError)
    expect(failure.message).toContain('agnes 调用失败')
  })
})
