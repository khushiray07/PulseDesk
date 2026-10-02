import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'chrome' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'npm run start -w server', url: 'http://127.0.0.1:5010/api/health', env: { PORT: '5010', DATABASE_URL: process.env.DATABASE_URL }, reuseExistingServer: false, timeout: 30000 },
    { command: process.env.PULSEDESK_E2E_PREVIEW === 'true' ? 'npm run preview -w client -- --port 5174 --strictPort' : 'npm run dev -w client -- --port 5174', url: 'http://127.0.0.1:5174', env: { API_PROXY_TARGET: 'http://127.0.0.1:5010' }, reuseExistingServer: false, timeout: 30000 },
  ],
});
