import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  waitForTask,
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

test('创建进行中的任务并取消后状态变为 cancelled', async ({ page, adminApi }) => {
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

  const task = await waitForTask(adminApi, taskId, 'cancelled', 30000);
  expect(task.status).toBe('cancelled');
});
