import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'output/playwright/test-results',
  // Keep the default run serial: live opt-in flows create and mutate isolated
  // fixtures, and serial execution makes the JSON result and shell exit status
  // attributable to one candidate run.
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.DAOFLOW_E2E_JSON_REPORT ?? 'output/playwright/last-run.json' }],
  ],
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'on',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    env: { ...process.env, DAOFLOW_E2E_DIST_DIR: 'output/playwright/.next-e2e' },
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
