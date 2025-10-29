import { defineConfig } from '@playwright/test';

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '127.0.0.1';
const url = process.env.BASE_URL || `http://${host}:${port}/`;

if (!process.env.BASE_URL) {
  process.env.BASE_URL = url;
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: url,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm dev --hostname 0.0.0.0 --port ${port}`,
    url,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120 * 1000,
  },
});
