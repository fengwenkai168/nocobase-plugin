import { test, expect } from '../test';
import {
  clearProducts,
  clearTasks,
  seedProducts,
  waitForTask,
  executeExport,
  readExportRows,
  getRecordCount,
  TEST_TABLE,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

function generateProductRows(count: number): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  for (let i = 1; i <= count; i++) {
    rows.push({
      name: `商品-${i}`,
      code: `CODE-${i.toString().padStart(8, '0')}`,
      sku: 1000000 + i,
      price: Number((Math.random() * 1000).toFixed(2)),
      stock: Math.floor(Math.random() * 1000),
      category: `分类-${(i % 10) + 1}`,
      supplier: `供应商-${(i % 5) + 1}`,
      published: i % 2 === 0,
    });
  }
  return rows;
}

async function batchSeedProducts(api: any, count: number) {
  const batchSize = 2000;
  const rows = generateProductRows(count);
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await seedProducts(api, batch);
  }
}

test.describe('大规模导出性能', () => {
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

  test('1000 行导出', async ({ adminApi }) => {
    await batchSeedProducts(adminApi, 1000);
    expect(await getRecordCount(adminApi)).toBe(1000);

    const start = Date.now();
    const taskId = await executeExport(adminApi, {
      tableName: TEST_TABLE,
      selectedFields: ['name', 'code', 'sku', 'price', 'stock', 'category', 'supplier', 'published'],
    });
    const task = await waitForTask(adminApi, taskId, 'completed', 300000);
    const duration = Date.now() - start;

    expect(task.status).toBe('completed');
    expect(task.processedRows).toBeGreaterThanOrEqual(1000);

    const { rows } = await readExportRows(adminApi, taskId);
    expect(rows.length).toBe(1000);
    // eslint-disable-next-line no-console
    console.log(`1000 行导出耗时: ${duration}ms`);
  });

  test('50000 行导出', async ({ adminApi }) => {
    await batchSeedProducts(adminApi, 50000);
    expect(await getRecordCount(adminApi)).toBe(50000);

    const start = Date.now();
    const taskId = await executeExport(adminApi, {
      tableName: TEST_TABLE,
      selectedFields: ['name', 'code', 'sku', 'price', 'stock', 'category', 'supplier', 'published'],
    });
    const task = await waitForTask(adminApi, taskId, 'completed', 600000);
    const duration = Date.now() - start;

    expect(task.status).toBe('completed');
    expect(task.processedRows).toBeGreaterThanOrEqual(50000);

    const { rows } = await readExportRows(adminApi, taskId);
    expect(rows.length).toBe(50000);
    // eslint-disable-next-line no-console
    console.log(`50000 行导出耗时: ${duration}ms`);
  });
});
