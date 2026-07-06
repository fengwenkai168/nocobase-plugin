import { test, expect } from './test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  seedProducts,
  waitForTask,
  createImportTaskFromFixture,
} from './helpers/sjgl02-helpers';

test.beforeEach(async ({ page, adminApi }) => {
  await ensurePluginEnabled(page);
  await clearProducts(adminApi);
  await clearTasks(adminApi);
});

test('管理员任务列表展示任务并查看详情', async ({ page, adminApi }) => {
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

  await taskRow.getByRole('button', { name: /详情/ }).click();
  await expect(page.getByText('任务详情')).toBeVisible();
  await expect(page.getByText('字段映射')).toBeVisible();
  await expect(page.getByText('执行日志')).toBeVisible();
});

test('管理员可取消进行中的任务', async ({ page, adminApi }) => {
  const createRes = await adminApi.post('/api/sjgl02_tasks:create', {
    data: {
      taskType: 'import',
      tableName: TEST_TABLE,
      status: 'processing',
      progress: 10,
      importMode: 'insert',
    },
  });
  const createData = await createRes.json();
  const taskId = createData.data?.id;
  expect(taskId).toBeTruthy();

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /任务管理/ }).click();
  const taskRow = page.locator('tr').filter({ hasText: `#${taskId}` });
  await expect(taskRow).toBeVisible();

  await taskRow.getByRole('button', { name: /取消/ }).click();
  await page.getByRole('button', { name: '确认取消' }).click();
  await page.waitForTimeout(2000);

  const task = await waitForTask(adminApi, taskId, 'cancelled', 30000);
  expect(task.status).toBe('cancelled');
});
