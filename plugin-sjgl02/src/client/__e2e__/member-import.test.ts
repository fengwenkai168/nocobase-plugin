import { test, expect } from './test';
import {
  TEST_TABLE,
  TEST_TABLE_TITLE,
  BLOCK_PAGE_URL,
  fixturePath,
  ensurePluginEnabled,
  clearProducts,
  clearTasks,
  clearPermissions,
  savePermissions,
  waitForTask,
  getRecordCount,
  uploadFileToAttachments,
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
      requiredFields: ['name'],
      importFields: ['name', 'stock'],
      exportFields: ['name'],
    },
  ]);
});

test.beforeEach(async ({ page, adminApi }) => {
  await ensurePluginEnabled(page);
  await clearProducts(adminApi);
  await clearTasks(adminApi);
});

test.afterAll(async ({ adminApi }) => {
  await savePermissions(adminApi, 'role', 'member', []);
  await clearPermissions(adminApi);
});

async function openImportTab(page: any) {
  await page.goto(BLOCK_PAGE_URL);
  await page.getByTestId('sjgl-block-tabs').getByText(/导入/).first().click();
  await expect(page.getByTestId('import-table-select')).toBeVisible();
}

async function selectImportTable(page: any) {
  await page.getByTestId('import-table-select').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: TEST_TABLE_TITLE }).first().click();
}

async function uploadImportFile(page: any, fileName: string) {
  await page.getByRole('button', { name: '下一步 →' }).first().click();
  await page.locator('input[type="file"]').setInputFiles(fixturePath(fileName));
  await expect(page.getByText(new RegExp(fileName.replace(/\./g, '\\.')))).toBeVisible();
}

test('普通用户导入模式受限', async ({ page, memberApi }) => {
  await openImportTab(page);
  await selectImportTable(page);
  await uploadImportFile(page, 'member-restricted.xlsx');

  const modeControl = page.getByTestId('import-mode-control');
  await expect(modeControl).toContainText('新增');
  await expect(modeControl).not.toContainText('更新');
  await expect(modeControl).not.toContainText('新增+更新');

  const fileId = await uploadFileToAttachments(memberApi, 'member-restricted.xlsx');
  const res = await memberApi.post('/api/sjgl02Import:execute', {
    data: {
      tableName: TEST_TABLE,
      fileId,
      sheetName: 'Sheet1',
      headerRow: 1,
      fieldMapping: { name: 'name', stock: 'stock' },
      customValues: {},
      importMode: 'update',
      uniqueFields: [],
      blankCellMode: 'update',
      permSource: null,
    },
  });
  expect(res.status()).toBe(403);
  const err = await res.json();
  expect(err.errors[0].message).toContain('update');
});

test('普通用户按允许字段完成导入', async ({ page, memberApi }) => {
  await openImportTab(page);
  await selectImportTable(page);
  await uploadImportFile(page, 'member-restricted.xlsx');

  const mappingTable = page.getByTestId('import-mapping-table');
  await expect(mappingTable).toContainText('name');
  await expect(mappingTable).toContainText('stock');
  await expect(mappingTable).not.toContainText('price');

  await page.getByRole('button', { name: '下一步 →' }).first().click();
  await expect(page.getByRole('button', { name: '▶ 执行导入' })).toBeVisible();

  await page.getByTestId('import-execute-btn').click();
  await page.locator('.ant-modal-confirm-btns .ant-btn-primary').click();

  await expect(page.getByText('导入任务已提交')).toBeVisible();

  const task = await getLatestTask(memberApi, 'import');
  expect(task).toBeTruthy();
  await waitForTask(memberApi, task.id);
  expect(await getRecordCount(memberApi)).toBe(2);
});
