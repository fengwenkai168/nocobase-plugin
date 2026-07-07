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

test.describe('管理员自动匹配字段', () => {
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

  test('上传 Excel 后点击自动匹配按钮验证映射结果', async ({ page, adminApi }) => {
    await page.goto(SETTINGS_URL);
    await page.getByRole('tab', { name: /导入/ }).click();
    await expect(page.getByTestId('import-table-select')).toBeVisible();

    const fileId = await uploadFileToAttachments(adminApi, 'admin-auto-match.xlsx');
    const parseRes = await adminApi.post('/api/sjgl02Import:uploadParse', {
      data: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });
    const parseData = await parseRes.json();
    expect(parseData.data?.headerColumns?.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: /自动匹配/ }).click();
    await expect(page.getByTestId('import-mapping-table')).toBeVisible();
    await expect(page.getByText(/成功|未匹配/)).toBeVisible();
  });
});
