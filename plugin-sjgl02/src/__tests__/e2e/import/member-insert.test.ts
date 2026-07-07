import { test, expect } from '../test';
import {
  BLOCK_PAGE_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  savePermissions,
  getRecordCount,
  loginAsMember,
  uploadFixture,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('普通用户 insert 导入', () => {
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

  test('普通用户在区块中完成 insert 导入', async ({ page, adminApi }) => {
    await loginAsMember(page);
    await page.goto(BLOCK_PAGE_URL);
    await page.getByRole('tab', { name: /导入/ }).click();
    await expect(page.getByTestId('import-table-select')).toBeVisible();

    await page.getByTestId('import-table-select').click();
    await page.getByText(new RegExp(TEST_TABLE_TITLE)).click();

    await uploadFixture(page, 'member-insert.xlsx');
    await expect(page.getByText('member-insert.xlsx')).toBeVisible();

    await page.getByRole('button', { name: /下一步/ }).click();
    await expect(page.getByTestId('import-execute-btn')).toBeVisible();

    await page.getByTestId('import-execute-btn').click();
    await page.locator('.ant-modal-confirm-btns').getByRole('button', { name: '确定' }).click();

    await expect(page.getByText(/导入任务已提交/)).toBeVisible();

    await page.waitForTimeout(3000);
    const count = await getRecordCount(adminApi);
    expect(count).toBeGreaterThan(0);
  });
});
