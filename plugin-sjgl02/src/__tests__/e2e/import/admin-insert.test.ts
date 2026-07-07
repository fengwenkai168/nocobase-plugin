import { test, expect } from '../test';
import {
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  createImportTaskFromFixture,
  waitForTask,
  getRecordCount,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员 insert 导入', () => {
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

  test('管理员 insert 导入新增 3 条记录', async ({ adminApi }) => {
    const taskId = await createImportTaskFromFixture(adminApi, 'admin-insert.xlsx', 'insert');
    const task = await waitForTask(adminApi, taskId);
    expect(task.status).toBe('completed');

    const count = await getRecordCount(adminApi);
    expect(count).toBe(3);
  });
});
