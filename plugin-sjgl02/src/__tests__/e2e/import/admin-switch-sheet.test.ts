import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  uploadFileToAttachments,
  fixturePath,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员切换 Sheet', () => {
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

  test('上传多 Sheet Excel 后切换 Sheet 表头变化', async ({ page, adminApi }) => {
    await page.goto(SETTINGS_URL);
    await page.getByRole('tab', { name: /导入/ }).click();
    await expect(page.getByTestId('import-table-select')).toBeVisible();

    const fileId = await uploadFileToAttachments(adminApi, 'admin-multi-sheet.xlsx');
    const parseRes = await adminApi.post('/api/sjgl02Import:uploadParse', {
      data: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });
    const parseData = await parseRes.json();
    expect(parseData.data?.sheets?.length).toBeGreaterThan(1);

    await page.getByRole('button', { name: /自动匹配/ }).click();
    await expect(page.getByTestId('import-mapping-table')).toBeVisible();

    const firstHeader = parseData.data.headerColumns[0];
    await expect(page.getByText(String(firstHeader))).toBeVisible();
  });
});
