import { expect, test } from '@playwright/test'

test('without private-service configuration, journal preserves the typed content and clearly reports unavailability', async ({ page }) => {
  await page.goto('/journal')
  await page.getByRole('link', { name: '新建心笺' }).click()
  await expect(page).toHaveURL(/\/journal\/new$/)
  await page.getByLabel(/^正文/).fill('断网或未配置时，这段内容不能消失。')
  await page.getByRole('button', { name: '保存心笺' }).click()
  await expect(page.getByText('私人记录服务尚未配置')).toBeVisible()
  await expect(page.getByLabel(/^正文/)).toHaveValue('断网或未配置时，这段内容不能消失。')
})

test.describe('authenticated journal lifecycle [BLOCKED: requires isolated local Supabase and two test users]', () => {
  test.skip(process.env.DAOFLOW_E2E_AUTH !== '1', 'Set DAOFLOW_E2E_AUTH=1 only with isolated local Auth/DB fixtures; do not replace this with mocked login.')

  test('save, refresh, edit, recycle, restore, and explicitly confirm permanent deletion', async ({ page }) => {
    // Fixture setup supplies authenticated storage state. Assertions intentionally remain
    // an acceptance checklist until real Auth/DB credentials are available.
    await page.goto('/journal')
    await page.getByLabel(/^正文/).fill('一封虚构的验收心笺。')
    await page.getByRole('button', { name: '保存心笺' }).click()
    await expect(page.getByText('已保存。')).toBeVisible()
    await page.reload()
    await page.getByLabel(/^正文/).fill('一封经过编辑的虚构验收心笺。')
    await page.getByRole('button', { name: '保存修改' }).click()
    await page.getByRole('button', { name: '移入回收站' }).click()
    await page.getByRole('button', { name: '恢复记录' }).click()
    await page.getByRole('button', { name: '移入回收站' }).click()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: '永久删除' }).click()
  })
})
