import { test, expect } from './test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  seedProducts,
  getRecordCount,
  getRecords,
  waitForTask,
  uploadFileToAttachments,
  executeImport,
} from './helpers/sjgl02-helpers';

test.beforeEach(async ({ page, adminApi }) => {
  await ensurePluginEnabled(page);
  await clearProducts(adminApi);
  await clearTasks(adminApi);
});

async function adminImport(page, adminApi, fileName: string, mode = 'insert', uniqueFields: string[] = []) {
  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /导入/ }).click();
  await expect(page.getByTestId('import-table-select')).toBeVisible();

  const fileId = await uploadFileToAttachments(adminApi, fileName);
  const parseRes = await adminApi.post('/api/sjgl02Import:uploadParse', {
    data: { fileId, sheetName: 'Sheet1', headerRow: 1 },
  });
  const parseData = await parseRes.json();
  const excelHeaders = parseData.data?.headerColumns || [];

  const fieldMapping: Record<string, string> = {};
  for (const h of excelHeaders) {
    fieldMapping[h] = h;
  }

  const taskId = await executeImport(adminApi, {
    tableName: TEST_TABLE,
    fileId,
    sheetName: 'Sheet1',
    headerRow: 1,
    fieldMapping,
    customValues: {},
    importMode: mode,
    uniqueFields,
    blankCellMode: 'update',
    permSource: null,
  });
  return { taskId, fileId };
}

test('管理员 insert 导入新增记录', async ({ page, adminApi }) => {
  expect(await getRecordCount(adminApi)).toBe(0);
  const { taskId } = await adminImport(page, adminApi, 'insert-sample.xlsx', 'insert');
  expect(taskId).toBeTruthy();
  const task = await waitForTask(adminApi, taskId);
  expect(task.status).toBe('completed');
  expect(await getRecordCount(adminApi)).toBe(3);
});

test('管理员 update 导入更新已有记录', async ({ page, adminApi }) => {
  await seedProducts(adminApi, [
    { name: 'Apple', price: 10.5, stock: 100 },
    { name: 'Banana', price: 20, stock: 200 },
  ]);

  const { taskId } = await adminImport(page, adminApi, 'update-sample.xlsx', 'update', ['name']);
  expect(taskId).toBeTruthy();
  const task = await waitForTask(adminApi, taskId);
  expect(task.status).toBe('completed');
  expect(await getRecordCount(adminApi)).toBe(2);

  const records = await getRecords(adminApi);
  const apple = records.find((r) => r.name === 'Apple');
  expect(apple.price).toBe(15);
});

test('管理员 upsert 导入混合更新与新增', async ({ page, adminApi }) => {
  await seedProducts(adminApi, [{ name: 'Apple', price: 10.5, stock: 100 }]);

  const { taskId } = await adminImport(page, adminApi, 'upsert-sample.xlsx', 'upsert', ['name']);
  expect(taskId).toBeTruthy();
  const task = await waitForTask(adminApi, taskId);
  expect(task.status).toBe('completed');
  expect(await getRecordCount(adminApi)).toBe(2);

  const records = await getRecords(adminApi);
  const apple = records.find((r) => r.name === 'Apple');
  const banana = records.find((r) => r.name === 'Banana');
  expect(apple.price).toBe(15);
  expect(banana).toBeTruthy();
});
