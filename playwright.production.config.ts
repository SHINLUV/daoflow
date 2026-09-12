import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'output/playwright-production',
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.DAOFLOW_E2E_JSON_REPORT ?? 'output/playwright-production/last-run.json' }],
  ],
  timeout: 30_000,
  use: {
    baseURL: process.env.DAOFLOW_PRODUCTION_BASE_URL ?? 'http://127.0.0.1:3200',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'on',
  },
})
