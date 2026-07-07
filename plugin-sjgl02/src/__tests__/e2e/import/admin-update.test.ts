import { test, expect } from '../test';
import {
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  seedProducts,
  createImportTaskFromFixture,
  waitForTask,
  getRecords,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员 update 导入', () => {
  test.beforeEach(async ({ page, adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await ensurePluginEnabled(page);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  test('管理员 update 导入更新价格', async ({ adminApi }) => {
    await seedProducts(adminApi, [
      { name: '商品A', code: 'A001', price: 10 },
      { name: '商品B', code: 'A002', price: 20 },
    ]);

    const taskId = await createImportTaskFromFixture(adminApi, 'admin-update.xlsx', 'update', ['code']);
    const task = await waitForTask(adminApi, taskId);
    expect(task.status).toBe('completed');

    const records = await getRecords(adminApi);
    const recordA = records.find((r) => r.code === 'A001');
    const recordB = records.find((r) => r.code === 'A002');
    expect(recordA).toBeDefined();
    expect(recordB).toBeDefined();
    expect(recordA.price).toBe(99);
    expect(recordB.price).toBe(199);
  });
});
