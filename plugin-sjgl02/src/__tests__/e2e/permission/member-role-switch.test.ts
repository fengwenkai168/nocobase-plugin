import { test, expect } from '../test';
import {
  BLOCK_PAGE_URL,
  BLOCK_PAGE_SCHEMA_UID,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  MEMBER_USERNAME,
  MEMBER_ROLE_NAME,
  ensurePluginEnabled,
  clearPermissions,
  savePermissions,
  loginAsMember,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment } from '../helpers/admin-api';
import { getMemberUserId, addRoleToUser, removeRoleFromUser, switchActiveRole } from '../helpers/member-api';

const SECOND_ROLE_NAME = 'e2e_sjgl02_second_role';

async function ensureSecondRole(api: any) {
  const existing = await api.get(
    `/api/roles:list?filter=${encodeURIComponent(JSON.stringify({ name: SECOND_ROLE_NAME }))}`,
  );
  const data = await existing.json();
  if (data.data?.length) return;

  const res = await api.post('/api/roles:create', {
    data: { name: SECOND_ROLE_NAME, title: 'E2E 数据管理第二角色', allowNewMenu: true },
  });
  if (!res.ok()) {
    throw new Error(`create second role failed: ${res.status()} ${await res.text()}`);
  }
}

async function grantBlockPageToRole(api: any, roleName: string) {
  const routeRes = await api.get(
    `/api/desktopRoutes:list?filter=${encodeURIComponent(JSON.stringify({ schemaUid: BLOCK_PAGE_SCHEMA_UID }))}`,
  );
  const routeData = await routeRes.json();
  const routeId = routeData.data?.[0]?.id;
  if (routeId) {
    await api.post(`/api/roles/${roleName}/desktopRoutes:add`, { data: [routeId] });
  }
  await api.post(`/api/roles/${roleName}/menuUiSchemas:add`, { data: [BLOCK_PAGE_SCHEMA_UID] });
}

async function cleanupSecondRole(api: any) {
  try {
    await api.post(`/api/roles:destroy?filter=${encodeURIComponent(JSON.stringify({ name: SECOND_ROLE_NAME }))}`);
  } catch {
    // ignore
  }
}

test.beforeAll(async ({ adminApi }) => {
  await setupE2EEnvironment(adminApi);
  await ensureSecondRole(adminApi);
  await grantBlockPageToRole(adminApi, SECOND_ROLE_NAME);
});

test.afterAll(async ({ adminApi }) => {
  await cleanupSecondRole(adminApi);
});

test.beforeEach(async ({ page, adminApi }) => {
  await clearPermissions(adminApi);
  await savePermissions(adminApi, 'role', MEMBER_ROLE_NAME, []);
  await savePermissions(adminApi, 'role', SECOND_ROLE_NAME, []);

  const userId = await getMemberUserId(adminApi, MEMBER_USERNAME);
  if (userId) {
    await removeRoleFromUser(adminApi, userId, SECOND_ROLE_NAME);
  }

  await loginAsMember(page);
  await ensurePluginEnabled(page);
});

test.afterEach(async ({ adminApi }) => {
  const userId = await getMemberUserId(adminApi, MEMBER_USERNAME);
  if (userId) {
    await removeRoleFromUser(adminApi, userId, SECOND_ROLE_NAME);
  }
  await savePermissions(adminApi, 'role', MEMBER_ROLE_NAME, []);
  await savePermissions(adminApi, 'role', SECOND_ROLE_NAME, []);
  await clearPermissions(adminApi);
});

test('普通用户属于两个角色，切换角色后权限变化', async ({ page, adminApi }) => {
  await savePermissions(adminApi, 'role', SECOND_ROLE_NAME, [
    {
      tableName: TEST_TABLE,
      canImport: true,
      canExport: false,
      importMode: ['insert'],
    },
  ]);

  const userId = await getMemberUserId(adminApi, MEMBER_USERNAME);
  expect(userId).toBeTruthy();
  if (!userId) throw new Error('Member user not found');
  await addRoleToUser(adminApi, userId, SECOND_ROLE_NAME);

  await page.goto(BLOCK_PAGE_URL);
  await page.getByTestId('sjgl-block-tabs').getByText(/导入/).first().click();

  const defaultRoleText = page.getByText('共 0 张表');
  await expect(defaultRoleText).toBeVisible();

  await switchActiveRole(page, SECOND_ROLE_NAME);
  await page.goto(BLOCK_PAGE_URL);
  await page.getByTestId('sjgl-block-tabs').getByText(/导入/).first().click();

  await expect(page.getByTestId('import-table-select')).toBeVisible();
  await page.getByTestId('import-table-select').click();
  await expect(
    page.locator('.ant-select-item-option-content').filter({ hasText: TEST_TABLE_TITLE }).first(),
  ).toBeVisible();
});
