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

test('点击详情按钮显示任务详情、字段映射、执行日志', async ({ page, adminApi }) => {
  await seedProducts(adminApi, [{ name: 'Apple', price: 10.5, stock: 100 }]);
  const taskId = await createImportTaskFromFixture(adminApi, 'insert-sample.xlsx', 'insert');
  expect(taskId).toBeTruthy();

  await waitForTask(adminApi, taskId);

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /任务管理/ }).click();
  const taskRow = page.locator('tr').filter({ hasText: `#${taskId}` });
  await expect(taskRow).toBeVisible();
  await expect(taskRow.getByText(new RegExp(TEST_TABLE_TITLE))).toBeVisible();

  await taskRow.getByRole('button', { name: /详情/ }).click();
  await expect(page.getByText(`任务 #${taskId}`)).toBeVisible();
  await expect(page.getByText('字段映射')).toBeVisible();
  await expect(page.getByText('执行日志')).toBeVisible();
});
