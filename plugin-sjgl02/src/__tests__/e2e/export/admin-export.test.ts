import { test, expect } from '../test';
import {
  clearProducts,
  clearTasks,
  seedProducts,
  waitForTask,
  executeExport,
  readExportRows,
  TEST_TABLE,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员基础导出', () => {
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

  test('基础导出并验证文件内容', async ({ adminApi }) => {
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

    const taskId = await executeExport(adminApi, {
      tableName: TEST_TABLE,
      selectedFields: ['name', 'code', 'price', 'stock', 'category'],
    });

    const task = await waitForTask(adminApi, taskId, 'completed');
    expect(task.status).toBe('completed');

    const { headers, rows } = await readExportRows(adminApi, taskId);
    expect(headers).toEqual(['商品名称(name)', '商品编码(code)', '价格(price)', '库存(stock)', '分类(category)']);
    expect(rows.length).toBe(2);
    expect(rows[0][0]).toBe('商品A');
    expect(rows[0][1]).toBe('A001');
    expect(rows[1][0]).toBe('商品B');
    expect(rows[1][1]).toBe('B002');
  });
});
