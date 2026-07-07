import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  seedProducts,
  uploadFileToAttachments,
  executeImport,
  waitForTask,
  getRecords,
  fixturePath,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员空白单元格处理', () => {
  const seed = { name: '原商品', code: 'A001', price: 100, stock: 50 };

  test.beforeEach(async ({ page, adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await ensurePluginEnabled(page);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await seedProducts(adminApi, [seed]);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  async function runImport(adminApi: any, blankCellMode: string) {
    const fileId = await uploadFileToAttachments(adminApi, 'admin-blank-cell.xlsx');
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
      importMode: 'update',
      uniqueFields: ['code'],
      blankCellMode,
      permSource: null,
    });
    return waitForTask(adminApi, taskId);
  }

  test('blankCellMode=update 时价格更新为空', async ({ adminApi }) => {
    await runImport(adminApi, 'update');
    const records = await getRecords(adminApi);
    const record = records.find((r) => r.code === 'A001');
    expect(record).toBeDefined();
    expect(record.price).toBeNull();
  });

  test('blankCellMode=null 时价格写入 NULL', async ({ adminApi }) => {
    await runImport(adminApi, 'null');
    const records = await getRecords(adminApi);
    const record = records.find((r) => r.code === 'A001');
    expect(record).toBeDefined();
    expect(record.price).toBeNull();
  });

  test('blankCellMode=skip 时价格保持原值', async ({ adminApi }) => {
    await runImport(adminApi, 'skip');
    const records = await getRecords(adminApi);
    const record = records.find((r) => r.code === 'A001');
    expect(record).toBeDefined();
    expect(record.price).toBe(100);
  });
});
