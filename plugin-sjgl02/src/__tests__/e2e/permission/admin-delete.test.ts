import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  MEMBER_ROLE_NAME,
  ensurePluginEnabled,
  clearPermissions,
  savePermissions,
  loginAsAdmin,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment } from '../helpers/admin-api';

test.beforeAll(async ({ adminApi }) => {
  await setupE2EEnvironment(adminApi);
});

test.beforeEach(async ({ page, adminApi }) => {
  await loginAsAdmin(page);
  await ensurePluginEnabled(page);
  await clearPermissions(adminApi);
});

test.afterEach(async ({ adminApi }) => {
  await clearPermissions(adminApi);
});

test('管理员删除权限后权限卡片消失', async ({ page, adminApi }) => {
  await savePermissions(adminApi, 'role', MEMBER_ROLE_NAME, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: true,
      importMode: ['insert'],
    },
  ]);

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /权限管理/ }).click();
  await page.getByText(new RegExp(`（${MEMBER_ROLE_NAME}）`)).click();

  const card = page.locator('.ant-card').filter({ hasText: `${TEST_TABLE_TITLE}(${TEST_TABLE})` });
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: '删除' }).click();

  await expect(card).toHaveCount(0);
});
