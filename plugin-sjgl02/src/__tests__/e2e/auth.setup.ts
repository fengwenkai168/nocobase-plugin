import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.resolve(__dirname, '.auth');
const adminAuthFile = path.join(authDir, 'admin.auth.json');
const memberAuthFile = path.join(authDir, 'member.auth.json');

if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

const ADMIN_EMAIL = 'admin@nocobase.com';
const ADMIN_PASSWORD = 'admin123';
const MEMBER_EMAIL = 'e2e_sjgl02_member@nocobase.com';
const MEMBER_PASSWORD = 'member123';

setup('authenticate admin', async ({ page }) => {
  await page.goto('/signin?redirect=/admin/settings/sjgl02');
  await page.getByPlaceholder('Username/Email').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('user-center-button')).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('NOCOBASE_DESIGNABLE', 'true');
  });
  await page.context().storageState({ path: adminAuthFile });
});

setup('authenticate member', async ({ page }) => {
  await page.goto('/signin?redirect=/admin');
  await page.getByPlaceholder('Username/Email').fill(MEMBER_EMAIL);
  await page.getByPlaceholder('Password').fill(MEMBER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('user-center-button')).toBeVisible();
  await page.context().storageState({ path: memberAuthFile });
});
