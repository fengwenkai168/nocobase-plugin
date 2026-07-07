import { test, expect } from '../test';
import {
  BLOCK_PAGE_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  savePermissions,
  seedProducts,
  getRecords,
  loginAsMember,
  uploadFixture,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('普通用户 update 导入', () => {
  test.beforeEach(async ({ page, adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await ensurePluginEnabled(page);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await seedProducts(adminApi, [
      { name: '商品A', code: 'A001', price: 10 },
      { name: '商品B', code: 'A002', price: 20 },
    ]);
    await savePermissions(adminApi, 'role', 'e2e_sjgl02_member_role', [
      {
        targetType: 'role',
        targetId: 'e2e_sjgl02_member_role',
        targetName: 'E2E 数据管理测试角色',
        tableName: TEST_TABLE,
        canImport: true,
        canExport: true,
        importMode: ['update'],
        uniqueFields: ['code'],
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

  test('普通用户在区块中完成 update 导入', async ({ page, adminApi }) => {
    await loginAsMember(page);
    await page.goto(BLOCK_PAGE_URL);
    await page.getByRole('tab', { name: /导入/ }).click();
    await expect(page.getByTestId('import-table-select')).toBeVisible();

    await page.getByTestId('import-table-select').click();
    await page.getByText(new RegExp(TEST_TABLE_TITLE)).click();

    await uploadFixture(page, 'member-update.xlsx');
    await expect(page.getByText('member-update.xlsx')).toBeVisible();

    await page.getByRole('button', { name: /下一步/ }).click();
    await expect(page.getByTestId('import-execute-btn')).toBeVisible();

    await page.getByTestId('import-execute-btn').click();
    await page.locator('.ant-modal-confirm-btns').getByRole('button', { name: '确定' }).click();

    await expect(page.getByText(/导入任务已提交/)).toBeVisible();

    await page.waitForTimeout(3000);
    const records = await getRecords(adminApi);
    expect(records.find((r) => r.code === 'A001')?.price).toBe(99);
    expect(records.find((r) => r.code === 'A002')?.price).toBe(199);
  });
});
