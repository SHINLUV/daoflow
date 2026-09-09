import { describe, expect, it } from 'vitest'
import { safeNext } from '../../src/lib/auth/safeNext'

describe('safeNext', () => {
  it.each([
    ['https://evil.example', '/journal'],
    ['//evil.example', '/journal'],
    ['/\\evil', '/journal'],
    [null, '/journal'],
    ['/journal', '/journal'],
    ['/journal/entries/test?from=login', '/journal/entries/test?from=login'],
  ])('keeps auth redirects in-app for %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})
