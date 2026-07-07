import { test, expect } from '../test';
import {
  BLOCK_PAGE_URL,
  MEMBER_AUTH_FILE,
  MEMBER_ROLE_NAME,
  clearProducts,
  clearTasks,
  clearPermissions,
  seedProducts,
  savePermissions,
  waitForTask,
  TEST_TABLE,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.use({ storageState: MEMBER_AUTH_FILE });

test.describe('普通用户区块导出', () => {
  test.beforeEach(async ({ adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await clearPermissions(adminApi);

    await savePermissions(adminApi, 'role', MEMBER_ROLE_NAME, [
      {
        tableName: TEST_TABLE,
        canImport: true,
        canExport: true,
        importMode: ['insert', 'update', 'upsert'],
        importFields: [],
        exportFields: ['name', 'code', 'price'],
        uniqueFields: [],
        requiredFields: [],
      },
    ]);

    await seedProducts(adminApi, [
      {
        name: '商品A',
        code: 'A001',
        sku: 1001,
        price: 9.99,
        stock: 10,
        category: '分类1',
        supplier: '供应商A',
        published: true,
      },
      {
        name: '商品B',
        code: 'B002',
        sku: 1002,
        price: 19.99,
        stock: 20,
        category: '分类2',
        supplier: '供应商B',
        published: false,
      },
    ]);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearTasks(adminApi);
    await clearPermissions(adminApi);
    await clearProducts(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  test('普通用户在区块中完成导出', async ({ page, adminApi }) => {
    await page.goto(BLOCK_PAGE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByText('⬆ 导出').click();
    await page.waitForSelector('[data-testid="export-table-select"]', { state: 'visible' });

    await page.getByTestId('export-table-select').click();
    await page.getByText(/E2E 测试商品/).click();
    await page.getByRole('button', { name: /下一步/ }).click();

    await page.waitForSelector('[data-testid="export-fields-section"]', { state: 'visible' });
    await page.getByText('商品名称(name)').click();
    await page.getByText('商品编码(code)').click();
    await page.getByText('价格(price)').click();
    await page.getByRole('button', { name: /下一步/ }).click();

    await page.waitForSelector('[data-testid="export-execute-btn"]', { state: 'visible' });
    await page.getByTestId('export-execute-btn').click();

    await page.waitForSelector('.ant-message-success, .ant-message-notice-content', {
      state: 'visible',
      timeout: 10000,
    });

    const listRes = await adminApi.get(`/api/sjgl02Tasks:list?taskType=export&pageSize=1&sort=-createdAt`);
    const listData = await listRes.json();
    const taskId = listData.data?.items?.[0]?.id;
    expect(taskId).toBeDefined();

    const latestTask = await waitForTask(adminApi, taskId, 'completed', 120000);
    expect(latestTask.status).toBe('completed');
  });
});
