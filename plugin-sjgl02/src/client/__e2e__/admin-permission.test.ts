import { test, expect } from './test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  ensurePluginEnabled,
  clearPermissions,
  savePermissions,
} from './helpers/sjgl02-helpers';

const TARGET_TYPE = 'role';
const TARGET_ID = 'member';

test.beforeEach(async ({ page, adminApi }) => {
  await ensurePluginEnabled(page);
  await clearPermissions(adminApi);
  await savePermissions(adminApi, TARGET_TYPE, TARGET_ID, []);
});

test.afterEach(async ({ adminApi }) => {
  await savePermissions(adminApi, TARGET_TYPE, TARGET_ID, []);
  await clearPermissions(adminApi);
});

async function openPermissionPanel(page) {
  await page.goto(SETTINGS_URL);
  await expect(page.getByText('Data Management')).toBeVisible();
  await page.getByRole('tab', { name: /权限管理/ }).click();
}

async function selectMemberRole(page) {
  const roleItem = page
    .locator('div')
    .filter({ hasText: /^Rmember/ })
    .first();
  await roleItem.waitFor({ state: 'visible' });
  await roleItem.click();
  await expect(page.getByText(/用户自定义权限/)).toBeVisible();
}

test('管理员新增并查看权限配置', async ({ page, adminApi }) => {
  await savePermissions(adminApi, TARGET_TYPE, TARGET_ID, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: true,
      importMode: ['insert', 'upsert'],
      uniqueFields: ['name'],
      requiredFields: ['name'],
      importFields: [],
      exportFields: ['name', 'price'],
    },
  ]);

  await openPermissionPanel(page);
  await selectMemberRole(page);

  await expect(page.getByText(`${TEST_TABLE_TITLE}(${TEST_TABLE})`)).toBeVisible();
  await expect(page.getByText('导入: 允许')).toBeVisible();
  await expect(page.getByText('导出: 允许')).toBeVisible();
  await expect(page.getByText('导入模式: 新增 / 新增+更新')).toBeVisible();
  await expect(page.getByText('唯一值: name')).toBeVisible();
});

test('管理员修改权限配置后回显正确', async ({ page, adminApi }) => {
  await savePermissions(adminApi, TARGET_TYPE, TARGET_ID, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: false,
      importMode: ['insert', 'upsert'],
      uniqueFields: ['name'],
    },
  ]);

  await openPermissionPanel(page);
  await selectMemberRole(page);
  await expect(page.getByText('导出: 不允许')).toBeVisible();

  await savePermissions(adminApi, TARGET_TYPE, TARGET_ID, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: true,
      importMode: ['insert'],
      uniqueFields: ['name'],
    },
  ]);

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /权限管理/ }).click();
  await selectMemberRole(page);
  await expect(page.getByText('导出: 允许')).toBeVisible();
  await expect(page.getByText('导入模式: 新增')).toBeVisible();
});

test('管理员修改权限后审计日志展示变更详情', async ({ page, adminApi }) => {
  await savePermissions(adminApi, TARGET_TYPE, TARGET_ID, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: false,
      importMode: ['insert'],
    },
  ]);

  await savePermissions(adminApi, TARGET_TYPE, TARGET_ID, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: true,
      importMode: ['insert', 'upsert'],
      uniqueFields: ['name'],
    },
  ]);

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /权限管理/ }).click();
  await selectMemberRole(page);
  await expect(page.getByText('导出: 允许')).toBeVisible();

  await page.getByText('📋 操作日志').click();
  await expect(page.getByText('修改配置').first()).toBeVisible();
  await page.locator('.ant-table-row-expand-icon').first().click();
  await expect(page.getByText('变更详情')).toBeVisible();
  await expect(page.getByText(new RegExp(`"${TEST_TABLE}"`))).toBeVisible();
});
