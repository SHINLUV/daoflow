import { expect, test } from '@playwright/test'

test.describe('DaoFlow V2 visual and motion contract', () => {
  test('integrated ink transition respects navigation semantics and releases its watchdog', async ({ page }) => {
    await page.goto('/')
    const mounted = await page.locator('[data-daoflow-ink-state]').count()
    test.skip(!mounted, 'MotionProvider has not yet been wired into AppShell by T08.')
    await page.getByRole('link', { name: '读经典' }).click()
    await expect(page.locator('[data-daoflow-ink-state="covering"], [data-daoflow-ink-state="navigating"], [data-daoflow-ink-state="revealing"]')).toHaveCount(0, { timeout: 6_000 })
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('[data-daoflow-ink-state="idle"]')).toHaveCount(1)
  })

  test('integrated navigation leaves modified links native and reduced motion usable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const mounted = await page.locator('[data-daoflow-ink-state]').count()
    test.skip(!mounted, 'MotionProvider has not yet been wired into AppShell by T08.')
    await page.getByRole('link', { name: '读经典' }).click({ modifiers: ['Control'] })
    await expect(page.locator('[data-daoflow-ink-state="covering"]')).toHaveCount(0)
  })

  test('the integrated home preserves mobile input, image loading, and no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '此刻，什么让你挂心？' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '记下此刻' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '问一问道' })).toBeVisible()
    await expect(page.locator('textarea')).toBeVisible()
    await expect(page.getByRole('button', { name: /保存心笺/ })).toBeVisible()
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBeTruthy()
    await expect(page.locator('img[src*="a01-hero-landscape"]').evaluate((image: HTMLImageElement) => image.naturalWidth > 0)).resolves.toBeTruthy()
  })

  test('the six realms use explicit selection and reduce motion does not block interaction', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.getByRole('tab', { name: '焦虑与情绪' }).click()
    await page.getByRole('button', { name: '最近总是很焦虑，停不下来。' }).click()
    await expect(page.getByRole('tab', { name: '问一问道' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('textarea')).toHaveValue('最近总是很焦虑，停不下来。')
  })
})
