import { APIRequestContext } from '@playwright/test';
import {
  TEST_TABLE,
  TEST_TABLE_TITLE,
  BLOCK_PAGE_SCHEMA_UID,
  BLOCK_TAB_SCHEMA_UID,
  MEMBER_USERNAME,
  MEMBER_ROLE_NAME,
} from './sjgl02-helpers';

export async function ensureTestCollection(api: APIRequestContext) {
  const existing = await api.get(
    `/api/collections:list?filter=${encodeURIComponent(JSON.stringify({ name: TEST_TABLE }))}`,
  );
  const data = await existing.json();
  if (data.data?.length) {
    return;
  }

  const res = await api.post('/api/collections:create', {
    data: {
      name: TEST_TABLE,
      title: TEST_TABLE_TITLE,
      createdBy: true,
      updatedBy: true,
      createdAt: true,
      updatedAt: true,
      fields: [
        { name: 'name', type: 'string', interface: 'input', required: true, uiSchema: { title: '商品名称' } },
        { name: 'code', type: 'string', interface: 'input', unique: true, uiSchema: { title: '商品编码' } },
        { name: 'sku', type: 'integer', interface: 'integer', unique: true, uiSchema: { title: 'SKU' } },
        { name: 'price', type: 'double', interface: 'number', uiSchema: { title: '价格' } },
        { name: 'stock', type: 'integer', interface: 'integer', uiSchema: { title: '库存' } },
        { name: 'category', type: 'string', interface: 'input', uiSchema: { title: '分类' } },
        { name: 'supplier', type: 'string', interface: 'input', uiSchema: { title: '供应商' } },
        { name: 'published', type: 'boolean', interface: 'checkbox', uiSchema: { title: '已发布' } },
        { name: 'description', type: 'text', interface: 'textarea', uiSchema: { title: '描述' } },
        { name: 'cover', type: 'attachment', interface: 'attachment', uiSchema: { title: '封面' } },
        { name: 'files', type: 'attachment', interface: 'attachment', multiple: true, uiSchema: { title: '附件' } },
      ],
    },
  });

  if (!res.ok()) {
    const text = await res.text();
    if (!text.includes('already exists')) {
      throw new Error(`create collection failed: ${res.status()} ${text}`);
    }
  }
}

export async function cleanupTestCollection(api: APIRequestContext) {
  try {
    await api.post(`/api/${TEST_TABLE}:destroy?filter=${encodeURIComponent(JSON.stringify({ id: { $ne: 0 } }))}`);
  } catch {
    // ignore
  }
}

export async function ensureTestPage(api: APIRequestContext) {
  const listRes = await api.get(
    `/api/desktopRoutes:list?filter=${encodeURIComponent(JSON.stringify({ schemaUid: BLOCK_PAGE_SCHEMA_UID }))}`,
  );
  const listData = await listRes.json();
  if (listData.data?.length) {
    return;
  }

  const pageSchemaRes = await api.post('/api/uiSchemas:insert', {
    data: {
      type: 'void',
      'x-uid': BLOCK_PAGE_SCHEMA_UID,
      'x-component': 'Page',
      'x-async': true,
      properties: {
        sjgl02Tab: {
          type: 'void',
          name: 'sjgl02Tab',
          'x-uid': BLOCK_TAB_SCHEMA_UID,
          'x-component': 'Grid',
          'x-initializer': 'page:addBlock',
          'x-async': false,
          properties: {
            row1: {
              type: 'void',
              'x-component': 'Grid.Row',
              properties: {
                col1: {
                  type: 'void',
                  'x-component': 'Grid.Col',
                  properties: {
                    sjgl02Block: {
                      type: 'void',
                      'x-component': 'SjglBlock',
                      'x-decorator': 'CardItem',
                      'x-decorator-props': { name: 'sjgl02' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!pageSchemaRes.ok()) throw new Error(`create page schema failed: ${await pageSchemaRes.text()}`);

  const routeRes = await api.post('/api/desktopRoutes:create', {
    data: {
      type: 'page',
      title: 'E2E 数据管理',
      schemaUid: BLOCK_PAGE_SCHEMA_UID,
      hideInMenu: false,
      enableTabs: false,
      children: [
        {
          type: 'tabs',
          title: 'E2E 数据管理',
          schemaUid: BLOCK_TAB_SCHEMA_UID,
          tabSchemaName: 'sjgl02Tab',
          hideInMenu: false,
          hidden: true,
        },
      ],
    },
  });
  if (!routeRes.ok()) throw new Error(`create route failed: ${await routeRes.text()}`);

  const routeData = await routeRes.json();
  const routeId = routeData.data?.id;

  if (routeId) {
    await api.post(`/api/roles/${MEMBER_ROLE_NAME}/desktopRoutes:add`, { data: [routeId] });
  }
  await api.post(`/api/roles/${MEMBER_ROLE_NAME}/menuUiSchemas:add`, { data: [BLOCK_PAGE_SCHEMA_UID] });
}

export async function cleanupTestPage(api: APIRequestContext) {
  try {
    await api.post(
      `/api/desktopRoutes:destroy?filter=${encodeURIComponent(JSON.stringify({ schemaUid: BLOCK_PAGE_SCHEMA_UID }))}`,
    );
  } catch {
    // ignore
  }
  try {
    await api.post(
      `/api/uiSchemas:destroy?filter=${encodeURIComponent(JSON.stringify({ 'x-uid': BLOCK_PAGE_SCHEMA_UID }))}`,
    );
  } catch {
    // ignore
  }
}

export async function ensureMemberRole(api: APIRequestContext) {
  const existing = await api.get(
    `/api/roles:list?filter=${encodeURIComponent(JSON.stringify({ name: MEMBER_ROLE_NAME }))}`,
  );
  const data = await existing.json();
  if (data.data?.length) {
    return;
  }

  const res = await api.post('/api/roles:create', {
    data: { name: MEMBER_ROLE_NAME, title: 'E2E 数据管理测试角色', allowNewMenu: true },
  });
  if (!res.ok()) {
    throw new Error(`create member role failed: ${res.status()} ${await res.text()}`);
  }
}

export async function cleanupMemberRole(api: APIRequestContext) {
  try {
    await api.post(`/api/roles:destroy?filter=${encodeURIComponent(JSON.stringify({ name: MEMBER_ROLE_NAME }))}`);
  } catch {
    // ignore
  }
}

export async function ensureMemberUser(api: APIRequestContext) {
  const existing = await api.get(
    `/api/users:list?filter=${encodeURIComponent(JSON.stringify({ username: MEMBER_USERNAME }))}`,
  );
  const data = await existing.json();
  if (data.data?.length) {
    return;
  }

  const res = await api.post('/api/users:create', {
    data: {
      username: MEMBER_USERNAME,
      nickname: 'E2E Member',
      email: 'e2e_sjgl02_member@nocobase.com',
      password: 'member123',
      roles: [{ name: MEMBER_ROLE_NAME }],
    },
  });
  if (!res.ok()) {
    throw new Error(`create member user failed: ${res.status()} ${await res.text()}`);
  }
}

export async function cleanupMemberUser(api: APIRequestContext) {
  try {
    await api.post(`/api/users:destroy?filter=${encodeURIComponent(JSON.stringify({ username: MEMBER_USERNAME }))}`);
  } catch {
    // ignore
  }
}

export async function setupE2EEnvironment(api: APIRequestContext) {
  await ensureMemberRole(api);
  await ensureTestCollection(api);
  await ensureTestPage(api);
  await ensureMemberUser(api);
}

export async function cleanupE2EEnvironment(api: APIRequestContext) {
  await cleanupTestPage(api);
  await cleanupTestCollection(api);
  await cleanupMemberUser(api);
  await cleanupMemberRole(api);
}
