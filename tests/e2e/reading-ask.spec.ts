import { existsSync } from 'fs'
import { test, expect } from '@playwright/test'

const storageState = process.env.DAOFLOW_E2E_STORAGE_STATE
const enabled = process.env.DAOFLOW_E2E_READING === '1' && Boolean(storageState && existsSync(storageState))
const askEnabled = process.env.DAOFLOW_E2E_ASK === '1' && Boolean(storageState && existsSync(storageState))

test('anonymous FavoriteControls leaves its initial loading state with a clear outcome', async ({ page }) => {
  await page.goto('/chapters/8')
  await expect(page.getByText('正在读取我的收藏…')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByText(/请先登录后管理收藏与批注|收藏需要数据库配置|收藏服务暂不可用|尚未收藏本章原文/)).toBeVisible()
})

test('anonymous ask consumes an in-tab draft without leaking it into the URL', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('daoflow:ask:draft', '我想慢一点看清这份焦虑。'))
  await page.goto('/ask')
  await expect(page).toHaveURL(/\/ask$/)
  await expect(page.getByLabel('你的问题')).toHaveValue('我想慢一点看清这份焦虑。')
  await page.getByRole('button', { name: '问一问道' }).click()
  await expect(page.getByRole('heading', { name: '我想慢一点看清这份焦虑。' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/本次回答不会进入历史|本次回答未保存到云端历史/)).toBeVisible()
})

test.describe('T04 reading and favorites — real authenticated browser flow', () => {
  test.skip(!enabled, 'BLOCKED: set DAOFLOW_E2E_READING=1 and DAOFLOW_E2E_STORAGE_STATE to a real local-Supabase authenticated storage state after migrations 003 then 004.')
  test.use({ storageState: storageState! })

  test('directory to chapter 8, translation, chapter and excerpt favorites, note, refresh and cancellation', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/chapters')
    await expect(page.getByRole('heading', { name: '读经典', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: '第 8 章' }).click()
    await expect(page).toHaveURL(/\/chapters\/8$/)
    await expect(page.getByRole('heading', { name: '第 8 章', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: '查看白话' }).click()
    await expect(page.getByText('最高的善就像水一样')).toBeVisible()

    await page.getByRole('button', { name: '收藏整章' }).click()
    await expect(page.getByText('已保存到我的收藏。')).toBeVisible()

    await page.locator('[data-reading-original]').evaluate((element) => {
      const text = element.firstChild
      if (!text) throw new Error('original text node missing')
      const selection = window.getSelection()
      const range = document.createRange()
      range.setStart(text, 0)
      range.setEnd(text, Math.min(8, text.textContent?.length ?? 0))
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
    await page.getByRole('button', { name: '收藏选中原文' }).click()
    await expect(page.getByTestId('favorite-item')).toHaveCount(2)
    await page.getByRole('button', { name: '添加批注' }).first().click()
    await page.getByLabel('我的批注').fill('第八章的阅读批注')
    await page.getByRole('button', { name: '保存批注' }).click()
    await page.reload()
    await expect(page.getByText('第八章的阅读批注')).toBeVisible()
    await page.getByRole('button', { name: '取消收藏' }).first().click()
    await expect(page.getByTestId('favorite-item')).toHaveCount(1)

    await page.screenshot({ path: testInfo.outputPath('reading-1440x900.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await page.screenshot({ path: testInfo.outputPath('reading-390x844.png'), fullPage: true })
  })
})

test.describe('T07 ask handoff — browser flow', () => {
  test.skip(!askEnabled, 'BLOCKED: set DAOFLOW_E2E_ASK=1 with a real local authenticated storage state and controllable-model fixture.')
  test.use({ storageState: storageState! })

  test('persists a draft, waits for the real result, and reloads it through the ID-only history URL', async ({ page }) => {
    const question = `E2E 问道 ${Date.now()}`
    let savedSessionId: string | null = null
    let savedInterpretation: string | null = null
    page.on('response', async response => {
      if (!response.url().includes('/api/ask') && !response.url().includes('/api/journal/ask-requests/')) return
      try {
        const body = await response.json() as { sessionId?: unknown; interpretation?: unknown; result?: { interpretation?: unknown } }
        if (typeof body.sessionId === 'string') savedSessionId = body.sessionId
        const interpretation = body.interpretation ?? body.result?.interpretation
        if (typeof interpretation === 'string') savedInterpretation = interpretation
      } catch { /* Non-JSON or intermediate responses are not the final saved result. */ }
    })
    await page.evaluate(value => sessionStorage.setItem('daoflow:ask:draft', JSON.stringify({ question: value })), question)
    await page.goto('/ask')
    await expect(page).toHaveURL(/\/ask$/)
    await expect(page.getByLabel('你的问题')).toHaveValue(question)
    await page.getByRole('button', { name: '问一问道' }).click()
    await expect(page.getByRole('heading', { name: question })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: '回应' })).toBeVisible()
    await expect.poll(() => savedSessionId, { timeout: 10_000 }).not.toBeNull()
    await expect.poll(() => savedInterpretation, { timeout: 10_000 }).not.toBeNull()

    await page.goto(`/ask?sessionId=${savedSessionId}`)
    await expect(page).toHaveURL(new RegExp(`/ask\\?sessionId=${savedSessionId}$`))
    await expect(page.getByRole('heading', { name: question })).toBeVisible()
    await expect(page.getByText(savedInterpretation!, { exact: true })).toBeVisible()
  })

  test('submits and persists the confirmed entry handoff with its owned links', async ({ page }) => {
    const entryId = process.env.DAOFLOW_E2E_ENTRY_ID
    const expectedVolumeValue = process.env.DAOFLOW_E2E_ENTRY_VOLUME_ID
    test.skip(!entryId || expectedVolumeValue === undefined, 'Set DAOFLOW_E2E_ENTRY_ID and DAOFLOW_E2E_ENTRY_VOLUME_ID (use "null" for no volume) for a current-user entry fixture.')
    const expectedVolumeId = expectedVolumeValue === 'null' ? null : expectedVolumeValue
    const question = `从心笺发起 ${Date.now()}`
    let submittedPayload: { sourceEntryId?: unknown; volumeId?: unknown } | null = null
    let savedSessionId: string | null = null
    let savedInterpretation: string | null = null
    page.on('request', request => {
      if (request.method() !== 'POST' || !request.url().endsWith('/api/ask')) return
      submittedPayload = request.postDataJSON() as { sourceEntryId?: unknown; volumeId?: unknown }
    })
    page.on('response', async response => {
      if (!response.url().includes('/api/ask') && !response.url().includes('/api/journal/ask-requests/')) return
      try {
        const body = await response.json() as { sessionId?: unknown; interpretation?: unknown; result?: { interpretation?: unknown } }
        if (typeof body.sessionId === 'string') savedSessionId = body.sessionId
        const interpretation = body.interpretation ?? body.result?.interpretation
        if (typeof interpretation === 'string') savedInterpretation = interpretation
      } catch { /* Ignore intermediate non-JSON responses. */ }
    })
    await page.goto(`/journal/entries/${entryId}`)
    await page.getByRole('button', { name: '带着这条记录问道' }).click()
    const editor = page.getByLabel('准备问道的问题')
    await expect(editor).toBeVisible()
    await editor.fill(question)
    await page.getByRole('button', { name: '确认并进入问道' }).click()
    await expect(page).toHaveURL(/\/ask$/)
    await expect(page.getByLabel('你的问题')).toHaveValue(question)
    expect(page.url()).not.toContain(encodeURIComponent(question))
    await page.getByRole('button', { name: '问一问道' }).click()
    await expect(page.getByRole('heading', { name: question })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: '回应' })).toBeVisible()
    await expect.poll(() => submittedPayload).toMatchObject({ sourceEntryId: entryId, volumeId: expectedVolumeId })
    await expect.poll(() => savedSessionId, { timeout: 10_000 }).not.toBeNull()
    await expect.poll(() => savedInterpretation, { timeout: 10_000 }).not.toBeNull()
    await expect(page.getByRole('button', { name: '仅重试保存' })).toHaveCount(0)

    const historyResponse = page.waitForResponse(response => response.url().endsWith(`/api/ask/${savedSessionId}`) && response.status() === 200)
    await page.goto(`/ask?sessionId=${savedSessionId}`)
    const history = await (await historyResponse).json() as { session: { sourceEntryId: string | null; volumeId: string | null; interpretation: string } }
    expect(history.session.sourceEntryId).toBe(entryId)
    expect(history.session.volumeId).toBe(expectedVolumeId)
    expect(history.session.interpretation).toBe(savedInterpretation)
    await expect(page.getByRole('heading', { name: question })).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(new RegExp(`/ask\\?sessionId=${savedSessionId}$`))
    await expect(page.getByRole('heading', { name: question })).toBeVisible()
  })

  test('recovers a generated request and retry-save does not invoke the model again', async ({ page, request }) => {
    const generatedRequestId = process.env.DAOFLOW_E2E_GENERATED_REQUEST_ID
    const ownerId = process.env.DAOFLOW_E2E_USER_ID
    const counterUrl = process.env.DAOFLOW_E2E_MODEL_COUNTER_URL
    test.skip(!generatedRequestId || !ownerId || !counterUrl, 'Requires a generated unsaved request, its owner ID, and model counter fixture.')
    const before = await (await request.get(counterUrl!)).json() as { count: number }
    await page.addInitScript(({ requestId, owner }) => sessionStorage.setItem('daoflow:ask:attempt', JSON.stringify({ ownerId: owner, requestId, question: '恢复服务端已生成回答', sourceEntryId: null, volumeId: null, state: 'processing', updatedAt: Date.now() })), { requestId: generatedRequestId!, owner: ownerId! })
    await page.goto('/ask')
    await expect(page.getByRole('button', { name: '仅重试保存' })).toBeVisible({ timeout: 30_000 })
    const saved = page.waitForResponse(response => response.url().endsWith(`/api/journal/ask-requests/${generatedRequestId}/retry-save`) && response.status() === 200)
    await page.getByRole('button', { name: '仅重试保存' }).click()
    await saved
    await expect(page.getByRole('button', { name: '仅重试保存' })).toHaveCount(0)
    const after = await (await request.get(counterUrl!)).json() as { count: number }
    expect(after.count).toBe(before.count)
  })
})
