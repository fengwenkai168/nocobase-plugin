import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.APP_BASE_URL || 'http://127.0.0.1:20000';
const authDir = path.resolve(__dirname, '.auth');

export default defineConfig({
  testDir: __dirname,
  timeout: 180 * 1000,
  expect: { timeout: 20 * 1000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 20 * 1000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'dataSetup',
      testMatch: 'data.setup.ts',
      dependencies: ['setup'],
    },
    {
      name: 'admin',
      testMatch: ['admin-*.test.ts', 'smoke.test.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(authDir, 'admin.auth.json'),
      },
      dependencies: ['dataSetup'],
    },
    {
      name: 'member',
      testMatch: 'member-*.test.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(authDir, 'member.auth.json'),
      },
      dependencies: ['dataSetup'],
    },
  ],
});
