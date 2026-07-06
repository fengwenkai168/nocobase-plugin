import { test, expect } from './test';
import ExcelJS from 'exceljs';
import {
  TEST_TABLE,
  TEST_TABLE_TITLE,
  BLOCK_PAGE_URL,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  clearPermissions,
  savePermissions,
  seedProducts,
  waitForTask,
  getLatestTask,
} from './helpers/sjgl02-helpers';

test.beforeAll(async ({ adminApi }) => {
  await clearPermissions(adminApi);
  await savePermissions(adminApi, 'role', 'member', [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: true,
      importMode: ['insert'],
      exportFields: ['name'],
    },
  ]);
});

test.beforeEach(async ({ page, adminApi }) => {
  await ensurePluginEnabled(page);
  await clearProducts(adminApi);
  await clearTasks(adminApi);
  await seedProducts(adminApi, [
    { name: 'Apple', price: 10.5, stock: 100 },
    { name: 'Banana', price: 20, stock: 200 },
    { name: 'Cherry', price: 5, stock: 50 },
  ]);
});

test.afterAll(async ({ adminApi }) => {
  await savePermissions(adminApi, 'role', 'member', []);
  await clearPermissions(adminApi);
});

async function readExportRows(buffer: Buffer): Promise<{ headers: string[]; rows: any[][] }> {
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

async function openExportTab(page: any) {
  await page.goto(BLOCK_PAGE_URL);
  await page.getByTestId('sjgl-block-tabs').getByText(/导出/).first().click();
  await expect(page.getByTestId('export-table-select')).toBeVisible();
}

async function selectExportTable(page: any) {
  await page.getByTestId('export-table-select').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: TEST_TABLE_TITLE }).first().click();
}

test('普通用户导出字段选择受 exportFields 限制', async ({ page }) => {
  await openExportTab(page);
  await selectExportTable(page);
  await page.getByRole('button', { name: '下一步 →' }).first().click();

  const fieldsSection = page.getByTestId('export-fields-section');
  await expect(fieldsSection).toContainText('商品名称(name)');
  await expect(fieldsSection).not.toContainText('price');
  await expect(fieldsSection).not.toContainText('stock');
});

test('普通用户完成导出', async ({ page, memberApi }) => {
  await openExportTab(page);
  await selectExportTable(page);
  await page.getByRole('button', { name: '下一步 →' }).first().click();

  await page.getByRole('button', { name: '下一步 →' }).first().click();
  await expect(page.getByRole('button', { name: '▶ 执行导出' })).toBeVisible();

  await page.getByTestId('export-execute-btn').click();
  await page.locator('.ant-modal-confirm-btns .ant-btn-primary').click();

  await expect(page.getByText('导出任务已提交')).toBeVisible();

  const task = await getLatestTask(memberApi, 'export');
  expect(task).toBeTruthy();
  await waitForTask(memberApi, task.id);

  const downloadRes = await memberApi.get(`/api/sjgl02Export:download?taskId=${task.id}`);
  expect(downloadRes.ok()).toBe(true);
  const buffer = await downloadRes.body();
  const { headers, rows } = await readExportRows(buffer);
  expect(headers).toContain('商品名称(name)');
  expect(rows.length).toBe(3);
});

test('空表导出生成只有表头的文件', async ({ page, memberApi, adminApi }) => {
  await clearProducts(adminApi);

  await openExportTab(page);
  await selectExportTable(page);
  await page.getByRole('button', { name: '下一步 →' }).first().click();

  await page.getByRole('button', { name: '下一步 →' }).first().click();
  await page.getByTestId('export-execute-btn').click();
  await page.locator('.ant-modal-confirm-btns .ant-btn-primary').click();

  await expect(page.getByText('导出任务已提交')).toBeVisible();

  const task = await getLatestTask(memberApi, 'export');
  expect(task).toBeTruthy();
  await waitForTask(memberApi, task.id);

  const downloadRes = await memberApi.get(`/api/sjgl02Export:download?taskId=${task.id}`);
  expect(downloadRes.ok()).toBe(true);
  const buffer = await downloadRes.body();
  const { headers, rows } = await readExportRows(buffer);
  expect(headers).toContain('商品名称(name)');
  expect(rows.length).toBe(0);
});
