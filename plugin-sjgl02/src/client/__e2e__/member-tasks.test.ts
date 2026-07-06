import { test, expect } from './test';
import {
  TEST_TABLE,
  MEMBER_USERNAME,
  BLOCK_PAGE_URL,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  clearPermissions,
  savePermissions,
  createImportTaskFromFixture,
  uploadFileToAttachments,
  executeImport,
} from './helpers/sjgl02-helpers';

test.beforeAll(async ({ adminApi }) => {
  await clearPermissions(adminApi);
  await savePermissions(adminApi, 'role', 'member', [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: false,
      importMode: ['insert'],
      importFields: ['name', 'stock'],
    },
  ]);
});

test.beforeEach(async ({ page, adminApi }) => {
  await ensurePluginEnabled(page);
  await clearProducts(adminApi);
  await clearTasks(adminApi);
});

test.afterAll(async ({ adminApi }) => {
  await savePermissions(adminApi, 'role', 'member', []);
  await clearPermissions(adminApi);
});

async function getMemberUserId(adminApi: any) {
  const res = await adminApi.get(
    `/api/users:list?filter=${encodeURIComponent(JSON.stringify({ username: MEMBER_USERNAME }))}`,
  );
  const data = await res.json();
  return data.data?.[0]?.id;
}

async function createMemberImportTask(api: any) {
  const fileId = await uploadFileToAttachments(api, 'insert-sample.xlsx');
  return executeImport(api, {
    tableName: TEST_TABLE,
    fileId,
    sheetName: 'Sheet1',
    headerRow: 1,
    fieldMapping: { name: 'name', stock: 'stock' },
    customValues: {},
    importMode: 'insert',
    uniqueFields: [],
    blankCellMode: 'update',
    permSource: null,
  });
}

test('普通用户只能看到自己的任务', async ({ page, memberApi, adminApi }) => {
  await createMemberImportTask(memberApi);
  await createImportTaskFromFixture(adminApi, 'insert-sample.xlsx', 'insert');

  await page.goto(BLOCK_PAGE_URL);
  await page
    .getByTestId('sjgl-block-tabs')
    .getByText(/任务管理/)
    .first()
    .click();

  const table = page.getByTestId('task-list-table');
  await expect(table).toBeVisible();
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(table).toContainText('导入');
});

test('普通用户可以取消自己的任务', async ({ page, memberApi, adminApi }) => {
  const userId = await getMemberUserId(adminApi);
  const createRes = await adminApi.post('/api/sjgl02_tasks:create', {
    data: {
      taskType: 'import',
      tableName: TEST_TABLE,
      status: 'processing',
      progress: 10,
      importMode: 'insert',
      createdById: userId,
    },
  });
  const createData = await createRes.json();
  const taskId = createData.data?.id;
  expect(taskId).toBeTruthy();

  await page.goto(BLOCK_PAGE_URL);
  await page
    .getByTestId('sjgl-block-tabs')
    .getByText(/任务管理/)
    .first()
    .click();

  const table = page.getByTestId('task-list-table');
  await expect(table).toBeVisible();
  await table.getByRole('button', { name: '⏹ 取消' }).click();
  await page.getByRole('button', { name: '确认取消' }).click();

  await expect(table.locator('tbody tr').first()).toContainText('已取消', { timeout: 30000 });
});
