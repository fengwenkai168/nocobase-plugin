import { test, expect } from '../test';
import {
  BLOCK_PAGE_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  MEMBER_USERNAME,
  MEMBER_ROLE_NAME,
  ensurePluginEnabled,
  clearPermissions,
  savePermissions,
  loginAsMember,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment } from '../helpers/admin-api';
import { getMemberUserId } from '../helpers/member-api';

test.beforeAll(async ({ adminApi }) => {
  await setupE2EEnvironment(adminApi);
});

test.beforeEach(async ({ page, adminApi }) => {
  await clearPermissions(adminApi);
  await loginAsMember(page);
  await ensurePluginEnabled(page);
});

test.afterEach(async ({ adminApi }) => {
  await clearPermissions(adminApi);
});

test('用户权限覆盖角色权限', async ({ page, adminApi }) => {
  await savePermissions(adminApi, 'role', MEMBER_ROLE_NAME, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: true,
      importMode: ['insert'],
    },
  ]);

  const userId = await getMemberUserId(adminApi, MEMBER_USERNAME);
  expect(userId).toBeTruthy();

  await savePermissions(adminApi, 'user', String(userId), [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: false,
      importMode: ['insert'],
    },
  ]);

  await page.goto(BLOCK_PAGE_URL);

  await page.getByTestId('sjgl-block-tabs').getByText(/导入/).first().click();
  await expect(page.getByTestId('import-table-select')).toBeVisible();
  await page.getByTestId('import-table-select').click();
  await expect(
    page.locator('.ant-select-item-option-content').filter({ hasText: TEST_TABLE_TITLE }).first(),
  ).toBeVisible();

  await page.getByTestId('sjgl-block-tabs').getByText(/导出/).first().click();
  await expect(page.getByTestId('export-table-select')).toBeVisible();
  await expect(page.getByText('共 0 个选项')).toBeVisible();
});
