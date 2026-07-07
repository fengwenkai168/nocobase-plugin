import { test, expect } from '../test';
import {
  SETTINGS_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  MEMBER_USERNAME,
  ensurePluginEnabled,
  clearPermissions,
  savePermissions,
  loginAsAdmin,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment } from '../helpers/admin-api';
import { getMemberUserId, addRoleToUser, removeRoleFromUser } from '../helpers/member-api';

const PARENT_ROLE_NAME = 'e2e_sjgl02_parent_role';

async function ensureParentRole(api: any) {
  const existing = await api.get(
    `/api/roles:list?filter=${encodeURIComponent(JSON.stringify({ name: PARENT_ROLE_NAME }))}`,
  );
  const data = await existing.json();
  if (data.data?.length) return;

  const res = await api.post('/api/roles:create', {
    data: { name: PARENT_ROLE_NAME, title: 'E2E 数据管理父角色', allowNewMenu: true },
  });
  if (!res.ok()) {
    throw new Error(`create parent role failed: ${res.status()} ${await res.text()}`);
  }
}

async function cleanupParentRole(api: any) {
  try {
    await api.post(`/api/roles:destroy?filter=${encodeURIComponent(JSON.stringify({ name: PARENT_ROLE_NAME }))}`);
  } catch {
    // ignore
  }
}

test.beforeAll(async ({ adminApi }) => {
  await setupE2EEnvironment(adminApi);
  await ensureParentRole(adminApi);
});

test.afterAll(async ({ adminApi }) => {
  await cleanupParentRole(adminApi);
});

test.beforeEach(async ({ page, adminApi }) => {
  await loginAsAdmin(page);
  await ensurePluginEnabled(page);
  await clearPermissions(adminApi);
  await savePermissions(adminApi, 'role', PARENT_ROLE_NAME, []);

  const userId = await getMemberUserId(adminApi, MEMBER_USERNAME);
  if (userId) {
    await removeRoleFromUser(adminApi, userId, PARENT_ROLE_NAME);
  }
});

test.afterEach(async ({ adminApi }) => {
  await clearPermissions(adminApi);
  const userId = await getMemberUserId(adminApi, MEMBER_USERNAME);
  if (userId) {
    await removeRoleFromUser(adminApi, userId, PARENT_ROLE_NAME);
  }
});

test('继承权限只读详情', async ({ page, adminApi }) => {
  await savePermissions(adminApi, 'role', PARENT_ROLE_NAME, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: false,
      importMode: ['insert', 'update'],
      uniqueFields: ['name'],
    },
  ]);

  const userId = await getMemberUserId(adminApi, MEMBER_USERNAME);
  expect(userId).toBeTruthy();
  if (!userId) throw new Error('Member user not found');
  await addRoleToUser(adminApi, userId, PARENT_ROLE_NAME);

  await page.goto(SETTINGS_URL);
  await page.getByRole('tab', { name: /权限管理/ }).click();
  await page.getByText('E2E Member').click();

  const card = page.locator('.ant-card').filter({ hasText: `${TEST_TABLE_TITLE}(${TEST_TABLE})` });
  await expect(card).toBeVisible();
  await expect(card.getByText('继承')).toBeVisible();

  await card.getByRole('button', { name: '查看详情' }).click();
  await expect(page.getByText('此权限为继承权限，不可在此编辑。')).toBeVisible();
  await expect(page.getByText('允许导入')).toBeVisible();
  await expect(page.getByText('允许导出')).toBeVisible();
});
