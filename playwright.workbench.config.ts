import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command:
      (process.env.PLAYWRIGHT_SKIP_BUILD ? '' : 'npm run build && ') +
      'npm run serve -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 300000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
