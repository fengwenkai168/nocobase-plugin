import { test, expect } from '../test';
import { SETTINGS_URL, ensurePluginEnabled, loginAsAdmin } from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment } from '../helpers/admin-api';

test.beforeAll(async ({ adminApi }) => {
  await setupE2EEnvironment(adminApi);
});

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test('设置页加载并展示四个标签页', async ({ page }) => {
  await ensurePluginEnabled(page);
  await expect(page.getByText('Data Management')).toBeVisible();
  await expect(page.getByRole('tab', { name: /导入/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /导出/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /任务管理/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /权限管理/ })).toBeVisible();
});
