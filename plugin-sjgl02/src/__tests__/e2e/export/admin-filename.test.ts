import { test, expect } from '../test';
import {
  clearProducts,
  clearTasks,
  seedProducts,
  waitForTask,
  executeExport,
  TEST_TABLE,
  TEST_TABLE_TITLE,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员导出文件名模板', () => {
  test.beforeEach(async ({ adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearTasks(adminApi);
    await clearProducts(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  test('文件名模板 {表名}_{日期}', async ({ adminApi }) => {
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
    ]);

    const taskId = await executeExport(adminApi, {
      tableName: TEST_TABLE,
      selectedFields: ['name', 'code'],
      fileNameTemplate: '{表名}_{日期}',
    });

    const task = await waitForTask(adminApi, taskId, 'completed');
    expect(task.status).toBe('completed');
    expect(task.fileName).toMatch(new RegExp(`^${TEST_TABLE_TITLE.replace(/\s+/g, '_')}_\\d{14}\\.xlsx$`));

    const res = await adminApi.get(`/api/sjgl02Export:download?taskId=${taskId}`);
    const disposition = res.headers()['content-disposition'] || '';
    expect(disposition).toContain(encodeURIComponent(task.fileName));
  });
});
