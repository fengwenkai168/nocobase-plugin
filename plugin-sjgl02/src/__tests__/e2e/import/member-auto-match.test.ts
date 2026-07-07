import { test, expect } from '../test';
import {
  BLOCK_PAGE_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  savePermissions,
  loginAsMember,
  uploadFixture,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('普通用户自动匹配字段', () => {
  test.beforeEach(async ({ page, adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await ensurePluginEnabled(page);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await savePermissions(adminApi, 'role', 'e2e_sjgl02_member_role', [
      {
        targetType: 'role',
        targetId: 'e2e_sjgl02_member_role',
        targetName: 'E2E 数据管理测试角色',
        tableName: TEST_TABLE,
        canImport: true,
        canExport: true,
        importMode: ['insert'],
        uniqueFields: [],
        requiredFields: [],
        importFields: [],
        exportFields: [],
      },
    ]);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  test('普通用户在区块中点击自动匹配', async ({ page }) => {
    await loginAsMember(page);
    await page.goto(BLOCK_PAGE_URL);
    await page.getByRole('tab', { name: /导入/ }).click();
    await expect(page.getByTestId('import-table-select')).toBeVisible();

    await page.getByTestId('import-table-select').click();
    await page.getByText(new RegExp(TEST_TABLE_TITLE)).click();

    await uploadFixture(page, 'member-auto-match.xlsx');
    await expect(page.getByText('member-auto-match.xlsx')).toBeVisible();

    await page.getByRole('button', { name: /自动匹配/ }).click();
    await expect(page.getByTestId('import-mapping-table')).toBeVisible();
    await expect(page.getByText(/成功|未匹配/)).toBeVisible();
  });
});
