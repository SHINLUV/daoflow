import { describe, expect, it } from 'vitest'
import { authCallbackStatusMessage, clearDaoFlowSessionStorage, safeNext } from '../../src/lib/auth/safeNext'

describe('safeNext', () => {
  it.each([
    ['https://evil.example', '/journal'],
    ['//evil.example', '/journal'],
    ['/\\evil', '/journal'],
    ['/\t/evil.example', '/journal'],
    ['/\r/evil.example', '/journal'],
    ['/\n/evil.example', '/journal'],
    ['/%09/evil.example', '/journal'],
    ['/%0d%0a/evil.example', '/journal'],
    ['/%2509/evil.example', '/journal'],
    ['/%2525252509/evil.example', '/journal'],
    ['/%2F%2Fevil.example', '/journal'],
    ['/%5cevil.example', '/journal'],
    ['/journal?note=%0Ahidden', '/journal'],
    [null, '/journal'],
    ['/', '/'],
    ['/journal', '/journal'],
    ['/journal?q=100%25', '/journal?q=100%25'],
    ['/journal?q=工作%2F生活', '/journal?q=工作%2F生活'],
    ['/journal?q=%E9%81%93', '/journal?q=%E9%81%93'],
    ['/journal/entries/test?from=login', '/journal/entries/test?from=login'],
  ])('keeps auth redirects in-app for %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})

describe('auth callback recovery', () => {
  it.each([
    ['failed', '登录链接无效或已经过期，请重新发送登录链接。'],
    ['missing-code', '登录链接不完整，请重新发送登录链接。'],
    ['unavailable', '登录服务暂不可用，请稍后重试。'],
  ])('provides a recoverable message for %s', (status, expected) => {
    expect(authCallbackStatusMessage(status)).toBe(expected)
  })

  it('ignores absent or unknown callback statuses', () => {
    expect(authCallbackStatusMessage(null)).toBeNull()
    expect(authCallbackStatusMessage('unexpected')).toBeNull()
  })
})

describe('sign-out session cleanup', () => {
  const userA = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'
  const userB = '53a1ab7a-0f42-4b53-8bf1-57036f97d8aa'

  it('removes only the signed-out account drafts and owner-tagged ask state', () => {
    const values = new Map([
      [`daoflow:journal:draft:${userA}:new`, 'private draft A'],
      [`daoflow:journal:draft:${userA}:entry-1`, 'private edit A'],
      [`daoflow:journal:draft:${userB}:new`, 'private draft B'],
      ['daoflow:journal:login:draft-a', 'login draft'],
      ['daoflow:ask:draft', 'anonymous question'],
      ['daoflow:ask:entry-handoff', JSON.stringify({ ownerId: userA, question: 'private handoff' })],
      ['daoflow:ask:attempt', JSON.stringify({ ownerId: userA, requestId: 'request-a' })],
      ['another-app:preference', 'keep'],
    ])
    const storage = {
      get length() { return values.size },
      key(index: number) { return Array.from(values.keys())[index] ?? null },
      getItem(key: string) { return values.get(key) ?? null },
      removeItem(key: string) { values.delete(key) },
    }

    clearDaoFlowSessionStorage(storage, userA)

    expect(Array.from(values.entries())).toEqual([
      [`daoflow:journal:draft:${userB}:new`, 'private draft B'],
      ['daoflow:journal:login:draft-a', 'login draft'],
      ['daoflow:ask:draft', 'anonymous question'],
      ['another-app:preference', 'keep'],
    ])
  })

  it('preserves another account owner-tagged ask state', () => {
    const values = new Map([
      ['daoflow:ask:entry-handoff', JSON.stringify({ ownerId: userB, question: 'private handoff B' })],
      ['daoflow:ask:attempt', JSON.stringify({ ownerId: userB, requestId: 'request-b' })],
    ])
    const storage = {
      get length() { return values.size },
      key(index: number) { return Array.from(values.keys())[index] ?? null },
      getItem(key: string) { return values.get(key) ?? null },
      removeItem(key: string) { values.delete(key) },
    }

    clearDaoFlowSessionStorage(storage, userA)

    expect(values.size).toBe(2)
  })
})
