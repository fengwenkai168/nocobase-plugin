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

test('管理员给角色添加权限后权限卡片显示', async ({ page, adminApi }) => {
  await savePermissions(adminApi, 'role', MEMBER_ROLE_NAME, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: true,
      importMode: ['insert', 'upsert'],
      uniqueFields: ['name'],
      requiredFields: ['name'],
      importFields: [],
      exportFields: ['name', 'price'],
    },
  ]);

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /权限管理/ }).click();
  await page.getByText(new RegExp(`（${MEMBER_ROLE_NAME}）`)).click();

  await expect(page.getByText(`${TEST_TABLE_TITLE}(${TEST_TABLE})`)).toBeVisible();
  await expect(page.getByText('导入: 允许')).toBeVisible();
  await expect(page.getByText('导出: 允许')).toBeVisible();
  await expect(page.getByText('导入模式: 新增 / 新增+更新')).toBeVisible();
  await expect(page.getByText('唯一值: name')).toBeVisible();
});
