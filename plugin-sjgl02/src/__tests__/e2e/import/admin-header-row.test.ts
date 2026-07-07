import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  uploadFileToAttachments,
  executeImport,
  waitForTask,
  getRecordCount,
  fixturePath,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员自定义表头行', () => {
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

  test('上传表头在第 3 行的 Excel 能正确导入', async ({ page, adminApi }) => {
    await page.goto(SETTINGS_URL);
    await page.getByRole('tab', { name: /导入/ }).click();
    await expect(page.getByTestId('import-table-select')).toBeVisible();

    const fileId = await uploadFileToAttachments(adminApi, 'admin-header-row.xlsx');
    const parseRes = await adminApi.post('/api/sjgl02Import:uploadParse', {
      data: { fileId, sheetName: 'Sheet1', headerRow: 3 },
    });
    const parseData = await parseRes.json();
    const excelHeaders = parseData.data?.headerColumns || [];
    expect(excelHeaders.length).toBeGreaterThan(0);

    const fieldMapping: Record<string, string> = {};
    for (const h of excelHeaders) {
      fieldMapping[h] = h;
    }

    const taskId = await executeImport(adminApi, {
      tableName: TEST_TABLE,
      fileId,
      sheetName: 'Sheet1',
      headerRow: 3,
      fieldMapping,
      customValues: {},
      importMode: 'insert',
      uniqueFields: [],
      blankCellMode: 'update',
      permSource: null,
    });

    const task = await waitForTask(adminApi, taskId);
    expect(task.status).toBe('completed');

    const count = await getRecordCount(adminApi);
    expect(count).toBeGreaterThan(0);
  });
});
