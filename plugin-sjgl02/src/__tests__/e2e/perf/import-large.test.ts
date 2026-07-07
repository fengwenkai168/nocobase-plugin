import { test, expect } from '../test';
import {
  clearProducts,
  clearTasks,
  waitForTask,
  executeImport,
  uploadBufferToAttachments,
  getRecordCount,
  TEST_TABLE,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const HEADERS = ['name', 'code', 'sku', 'price', 'stock', 'category', 'supplier', 'published'];

function generateRows(count: number): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  for (let i = 1; i <= count; i++) {
    rows.push({
      name: `商品-${i}`,
      code: `CODE-${i.toString().padStart(8, '0')}`,
      sku: 1000000 + i,
      price: Number((Math.random() * 1000).toFixed(2)),
      stock: Math.floor(Math.random() * 1000),
      category: `分类-${(i % 10) + 1}`,
      supplier: `供应商-${(i % 5) + 1}`,
      published: i % 2 === 0,
    });
  }
  return rows;
}

async function buildLargeExcel(count: number): Promise<{ filePath: string; buffer: Buffer }> {
  const filePath = path.join('/tmp', `sjgl02_import_${count}_${Date.now()}.xlsx`);
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath, useSharedStrings: true });
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(HEADERS).commit();
  const rows = generateRows(count);
  for (const row of rows) {
    ws.addRow(HEADERS.map((h) => row[h])).commit();
  }
  await ws.commit();
  await wb.commit();
  const buffer = fs.readFileSync(filePath);
  return { filePath, buffer };
}

async function runImport(api: any, fileId: number): Promise<number> {
  const parseRes = await api.post('/api/sjgl02Import:uploadParse', {
    data: { fileId, sheetName: 'Sheet1', headerRow: 1 },
  });
  const parseData = await parseRes.json();
  const excelHeaders = parseData.data?.headerColumns || [];
  const fieldMapping: Record<string, string> = {};
  for (const h of excelHeaders) {
    fieldMapping[h] = h;
  }
  return executeImport(api, {
    tableName: TEST_TABLE,
    fileId,
    sheetName: 'Sheet1',
    headerRow: 1,
    fieldMapping,
    customValues: {},
    importMode: 'insert',
    uniqueFields: [],
    blankCellMode: 'update',
    permSource: null,
  });
}

test.describe('大规模导入性能', () => {
  test.beforeEach(async ({ adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearTasks(adminApi);
    await clearProducts(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  test('1000 行导入', async ({ adminApi }) => {
    const { filePath, buffer } = await buildLargeExcel(1000);
    try {
      const fileId = await uploadBufferToAttachments(adminApi, 'import-1000.xlsx', buffer);
      const start = Date.now();
      const taskId = await runImport(adminApi, fileId);
      const task = await waitForTask(adminApi, taskId, 'completed', 300000);
      const duration = Date.now() - start;

      expect(task.status).toBe('completed');
      expect(task.processedRows).toBeGreaterThanOrEqual(1000);
      const count = await getRecordCount(adminApi);
      expect(count).toBe(1000);
      // eslint-disable-next-line no-console
      console.log(`1000 行导入耗时: ${duration}ms`);
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
  });

  test('50000 行导入', async ({ adminApi }) => {
    const { filePath, buffer } = await buildLargeExcel(50000);
    try {
      const fileId = await uploadBufferToAttachments(adminApi, 'import-50000.xlsx', buffer);
      const start = Date.now();
      const taskId = await runImport(adminApi, fileId);
      const task = await waitForTask(adminApi, taskId, 'completed', 600000);
      const duration = Date.now() - start;

      expect(task.status).toBe('completed');
      expect(task.processedRows).toBeGreaterThanOrEqual(50000);
      const count = await getRecordCount(adminApi);
      expect(count).toBe(50000);
      // eslint-disable-next-line no-console
      console.log(`50000 行导入耗时: ${duration}ms`);
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
  });
});
