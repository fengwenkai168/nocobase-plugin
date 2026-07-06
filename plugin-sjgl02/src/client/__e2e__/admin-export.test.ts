import { test, expect } from './test';
import ExcelJS from 'exceljs';
import {
  SETTINGS_URL,
  TEST_TABLE,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  seedProducts,
  waitForTask,
  executeExport,
} from './helpers/sjgl02-helpers';

async function readExportBuffer(api, taskId: number): Promise<Buffer> {
  const res = await api.get(`/api/sjgl02Export:download?taskId=${taskId}`);
  if (!res.ok()) {
    throw new Error(`download export failed: ${res.status()} ${await res.text()}`);
  }
  return res.body();
}

async function parseExportRows(buffer: Buffer): Promise<{ headers: string[]; rows: any[][] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const headers = ws.getRow(1).values.slice(1) as string[];
  const rows: any[][] = [];
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    rows.push(row.values.slice(1));
  });
  return { headers, rows };
}

test.beforeEach(async ({ page, adminApi }) => {
  await ensurePluginEnabled(page);
  await clearProducts(adminApi);
  await clearTasks(adminApi);
});

test('管理员导出并下载文件验证内容', async ({ page, adminApi }) => {
  await seedProducts(adminApi, [
    { name: 'Apple', price: 10.5, stock: 100 },
    { name: 'Banana', price: 20, stock: 200 },
    { name: 'Cherry', price: 5, stock: 50 },
  ]);

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /导出/ }).click();
  await expect(page.getByTestId('export-table-select')).toBeVisible();

  const taskId = await executeExport(adminApi, {
    tableName: TEST_TABLE,
    selectedFields: ['name', 'price'],
  });
  expect(taskId).toBeTruthy();

  const task = await waitForTask(adminApi, taskId);
  expect(task.status).toBe('completed');

  const buffer = await readExportBuffer(adminApi, taskId);
  const { headers, rows } = await parseExportRows(buffer);
  expect(headers).toContain('商品名称(name)');
  expect(headers).toContain('价格(price)');
  expect(rows.length).toBe(3);
});
