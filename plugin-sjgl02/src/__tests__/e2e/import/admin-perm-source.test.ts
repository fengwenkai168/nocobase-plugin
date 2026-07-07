import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  savePermissions,
  uploadFileToAttachments,
  executeImport,
  waitForTask,
  getRecordCount,
  fixturePath,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员切换普通用户方案导入', () => {
  const memberPermission = {
    targetType: 'role',
    targetId: 'e2e_sjgl02_member_role',
    targetName: 'E2E 数据管理测试角色',
    tableName: TEST_TABLE,
    canImport: true,
    canExport: true,
    importMode: ['insert'],
    uniqueFields: [],
    requiredFields: [],
    importFields: [],
    exportFields: [],
  };

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

  async function runImport(adminApi: any, permSource: { type: string; id?: string } | null) {
    const fileId = await uploadFileToAttachments(adminApi, 'admin-perm-source.xlsx');
    const parseRes = await adminApi.post('/api/sjgl02Import:uploadParse', {
      data: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });
    const parseData = await parseRes.json();
    const excelHeaders = parseData.data?.headerColumns || [];
    const fieldMapping: Record<string, string> = {};
    for (const h of excelHeaders) {
      fieldMapping[h] = h;
    }

    return adminApi.post('/api/sjgl02Import:execute', {
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
        permSource,
      },
    });
  }

  test('管理员使用有权限的普通角色方案导入成功', async ({ page, adminApi }) => {
    await savePermissions(adminApi, 'role', 'e2e_sjgl02_member_role', [memberPermission]);

    const res = await runImport(adminApi, { type: 'role', id: 'e2e_sjgl02_member_role' });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const task = await waitForTask(adminApi, data.data?.taskId);
    expect(task.status).toBe('completed');

    const count = await getRecordCount(adminApi);
    expect(count).toBeGreaterThan(0);
  });

  test('管理员使用无权限的普通角色方案导入失败', async ({ page, adminApi }) => {
    await savePermissions(adminApi, 'role', 'e2e_sjgl02_member_role', [{ ...memberPermission, canImport: false }]);

    const res = await runImport(adminApi, { type: 'role', id: 'e2e_sjgl02_member_role' });
    expect(res.status()).toBe(403);
  });
});
