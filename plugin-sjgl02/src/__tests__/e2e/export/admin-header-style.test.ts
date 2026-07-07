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

test.describe('管理员导出表头格式', () => {
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

  test('title_id 表头格式', async ({ adminApi }) => {
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
      headerStyle: 'title_id',
    });

    await waitForTask(adminApi, taskId, 'completed');
    const { headers } = await readExportRows(adminApi, taskId);
    expect(headers).toEqual(['商品名称(name)', '商品编码(code)']);
  });

  test('title 表头格式', async ({ adminApi }) => {
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
      headerStyle: 'title',
    });

    await waitForTask(adminApi, taskId, 'completed');
    const { headers } = await readExportRows(adminApi, taskId);
    expect(headers).toEqual(['商品名称', '商品编码']);
  });

  test('id 表头格式', async ({ adminApi }) => {
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
      headerStyle: 'id',
    });

    await waitForTask(adminApi, taskId, 'completed');
    const { headers } = await readExportRows(adminApi, taskId);
    expect(headers).toEqual(['name', 'code']);
  });
});
