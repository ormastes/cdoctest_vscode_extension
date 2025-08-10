import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.join(__dirname, 'specs'),
  timeout: 120000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 30000,
  },

  projects: [
    {
      name: 'vscode-extension',
      use: {
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  outputDir: 'test-results/',
});