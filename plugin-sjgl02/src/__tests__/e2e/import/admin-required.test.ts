import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  savePermissions,
  uploadFileToAttachments,
  executeImport,
  fixturePath,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员必填字段校验', () => {
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

  test('导入缺失 name 的 Excel 应返回 400', async ({ page, adminApi }) => {
    await savePermissions(adminApi, 'role', 'e2e_sjgl02_member_role', [
      {
        targetType: 'role',
        targetId: 'e2e_sjgl02_member_role',
        targetName: 'E2E 数据管理测试角色',
        tableName: TEST_TABLE,
        canImport: true,
        canExport: true,
        importMode: ['insert'],
        uniqueFields: [],
        requiredFields: ['name'],
        importFields: [],
        exportFields: [],
      },
    ]);

    await page.goto(SETTINGS_URL);
    await page.getByRole('tab', { name: /导入/ }).click();
    await expect(page.getByTestId('import-table-select')).toBeVisible();

    const fileId = await uploadFileToAttachments(adminApi, 'admin-required-missing.xlsx');
    const parseRes = await adminApi.post('/api/sjgl02Import:uploadParse', {
      data: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });
    const parseData = await parseRes.json();
    const excelHeaders = parseData.data?.headerColumns || [];
    const fieldMapping: Record<string, string> = {};
    for (const h of excelHeaders) {
      fieldMapping[h] = h;
    }

    const res = await adminApi.post('/api/sjgl02Import:execute', {
      data: {
        tableName: TEST_TABLE,
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping,
        customValues: {},
        importMode: 'insert',
        uniqueFields: [],
        blankCellMode: 'update',
        permSource: { type: 'role', id: 'e2e_sjgl02_member_role' },
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.errors?.[0]?.message || body.message || '').toContain('name');
  });
});
