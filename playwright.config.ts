import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 920 },
    baseURL: 'http://127.0.0.1:4179'
  },
  webServer: {
    command: 'npx vite --config tests/ui/vite.config.ts',
    url: 'http://127.0.0.1:4179/tests/ui/fixture.html',
    reuseExistingServer: !process.env.CI
  }
})
