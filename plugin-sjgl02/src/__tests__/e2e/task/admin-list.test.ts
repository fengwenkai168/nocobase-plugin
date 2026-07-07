import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE_TITLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  seedProducts,
  waitForTask,
  createImportTaskFromFixture,
  loginAsAdmin,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment } from '../helpers/admin-api';

test.beforeAll(async ({ adminApi }) => {
  await setupE2EEnvironment(adminApi);
});

test.beforeEach(async ({ page, adminApi }) => {
  await loginAsAdmin(page);
  await ensurePluginEnabled(page);
  await clearProducts(adminApi);
  await clearTasks(adminApi);
});

test('任务列表展示任务', async ({ page, adminApi }) => {
  await seedProducts(adminApi, [{ name: 'Apple', price: 10.5, stock: 100 }]);
  const taskId = await createImportTaskFromFixture(adminApi, 'insert-sample.xlsx', 'insert');
  expect(taskId).toBeTruthy();

  await waitForTask(adminApi, taskId);

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /任务管理/ }).click();
  const taskRow = page.locator('tr').filter({ hasText: `#${taskId}` });
  await expect(taskRow).toBeVisible();
  await expect(taskRow.getByText('📥 导入')).toBeVisible();
  await expect(taskRow.getByText(new RegExp(TEST_TABLE_TITLE))).toBeVisible();
});
