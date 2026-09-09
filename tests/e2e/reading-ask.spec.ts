import { existsSync } from 'fs'
import { test, expect } from '@playwright/test'

const storageState = process.env.DAOFLOW_E2E_STORAGE_STATE
const enabled = process.env.DAOFLOW_E2E_READING === '1' && Boolean(storageState && existsSync(storageState))

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
  test.use({ storageState })

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
  test.skip(process.env.DAOFLOW_E2E_ASK !== '1', 'BLOCKED: requires a local controllable-model fixture plus real authenticated storage state after migration 005.')

  test('reads the in-tab draft instead of question URL and preserves an honest persistence status', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => sessionStorage.setItem('daoflow:ask:draft', JSON.stringify({ question: '我该如何面对眼前的选择？' })))
    await page.goto('/ask')
    await expect(page).toHaveURL(/\/ask$/)
    await expect(page.getByLabel('你的问题')).toHaveValue('我该如何面对眼前的选择？')
    await page.getByRole('button', { name: '问一问道' }).click()
    await expect(page.locator('main')).not.toContainText('已保存')
  })
})
