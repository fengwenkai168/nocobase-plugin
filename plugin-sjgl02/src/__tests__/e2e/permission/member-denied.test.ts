import { test, expect } from '../test';
import {
  BLOCK_PAGE_URL,
  ensurePluginEnabled,
  clearPermissions,
  savePermissions,
  loginAsMember,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment } from '../helpers/admin-api';

test.beforeAll(async ({ adminApi }) => {
  await setupE2EEnvironment(adminApi);
});

test.beforeEach(async ({ page, adminApi }) => {
  await clearPermissions(adminApi);
  await savePermissions(adminApi, 'role', 'member', []);
  await loginAsMember(page);
  await ensurePluginEnabled(page);
});

test.afterEach(async ({ adminApi }) => {
  await savePermissions(adminApi, 'role', 'member', []);
  await clearPermissions(adminApi);
});

test('普通用户无权限时导入面板中表选择列表为空', async ({ page }) => {
  await page.goto(BLOCK_PAGE_URL);
  await page.getByTestId('sjgl-block-tabs').getByText(/导入/).first().click();
  await expect(page.getByTestId('import-table-select')).toBeVisible();
  await expect(page.getByText('共 0 张表')).toBeVisible();
});

test('普通用户无权限时导出面板中表选择列表为空', async ({ page }) => {
  await page.goto(BLOCK_PAGE_URL);
  await page.getByTestId('sjgl-block-tabs').getByText(/导出/).first().click();
  await expect(page.getByTestId('export-table-select')).toBeVisible();
  await expect(page.getByText('共 0 个选项')).toBeVisible();
});
