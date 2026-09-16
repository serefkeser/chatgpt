import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173/chatgpt/', trace: 'retain-on-failure' },
  projects: [{ name: 'firefox', use: { browserName: 'firefox' } }],
  webServer: [
    { command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173/chatgpt/', reuseExistingServer: !process.env.CI },
    { command: 'npm run dev -- --port 5173', url: 'http://127.0.0.1:5173/chatgpt/', reuseExistingServer: !process.env.CI },
  ],
});
