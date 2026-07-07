import { test, expect } from '../test';
import {
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  seedProducts,
  createImportTaskFromFixture,
  waitForTask,
  getRecords,
  getRecordCount,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员 upsert 导入', () => {
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

  test('管理员 upsert 导入 1 更新 + 1 新增', async ({ adminApi }) => {
    await seedProducts(adminApi, [{ name: '旧商品', code: 'A001', price: 10 }]);

    const taskId = await createImportTaskFromFixture(adminApi, 'admin-upsert.xlsx', 'upsert', ['code']);
    const task = await waitForTask(adminApi, taskId);
    expect(task.status).toBe('completed');

    const count = await getRecordCount(adminApi);
    expect(count).toBe(2);

    const records = await getRecords(adminApi);
    const updated = records.find((r) => r.code === 'A001');
    const created = records.find((r) => r.code === 'A002');
    expect(updated).toBeDefined();
    expect(created).toBeDefined();
    expect(updated.price).toBe(88);
    expect(created.name).toBe('新商品');
  });
});
