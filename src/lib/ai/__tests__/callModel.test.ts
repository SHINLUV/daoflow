import { describe, expect, it } from 'vitest'
import { EmptyResponseError, FormatError, NetworkError, ProviderFailure, RateLimitedError, TimeoutError, classifyAgnesFailure, normalizeModelFailure } from '../callModel'

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
})
