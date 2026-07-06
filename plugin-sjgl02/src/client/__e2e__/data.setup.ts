import { test as setup, expect, request } from '@playwright/test';
import path from 'path';
import {
  SETTINGS_URL,
  TEST_TABLE,
  TEST_TABLE_TITLE,
  BLOCK_PAGE_SCHEMA_UID,
  BLOCK_TAB_SCHEMA_UID,
  BLOCK_PAGE_URL,
  MEMBER_USERNAME,
  getAdminToken,
} from './helpers/sjgl02-helpers';

const authDir = path.resolve(__dirname, '.auth');
const adminAuthFile = path.join(authDir, 'admin.auth.json');
const memberAuthFile = path.join(authDir, 'member.auth.json');
const baseURL = process.env.APP_BASE_URL || 'http://127.0.0.1:20000';

setup('prepare test data', async ({ browser }) => {
  const token = await getAdminToken(baseURL);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const apiContext = await request.newContext({ baseURL, extraHTTPHeaders: authHeaders });

  // 创建测试集合
  const collectionRes = await apiContext.post('/api/collections:create', {
    data: {
      name: TEST_TABLE,
      title: TEST_TABLE_TITLE,
      createdBy: true,
      updatedBy: true,
      createdAt: true,
      updatedAt: true,
      fields: [
        { name: 'name', type: 'string', interface: 'input', required: true, uiSchema: { title: '商品名称' } },
        { name: 'price', type: 'double', interface: 'number', uiSchema: { title: '价格' } },
        { name: 'stock', type: 'integer', interface: 'integer', uiSchema: { title: '库存' } },
      ],
    },
  });
  if (!collectionRes.ok()) {
    const text = await collectionRes.text();
    if (!text.includes('already exists')) {
      throw new Error(`create collection failed: ${collectionRes.status()} ${text}`);
    }
  }

  // 创建页面 schema（Page 壳 + Grid tab 内容）
  const listRes = await apiContext.get(
    `/api/desktopRoutes:list?filter=${encodeURIComponent(JSON.stringify({ schemaUid: BLOCK_PAGE_SCHEMA_UID }))}`,
  );
  const listData = await listRes.json();
  if (!listData.data?.length) {
    const pageSchemaRes = await apiContext.post('/api/uiSchemas:insert', {
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

    const routeRes = await apiContext.post('/api/desktopRoutes:create', {
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

    // 显式把页面授权给 member 角色（避免 allowNewMenu 未生效导致页面空白）
    if (routeId) {
      const routeGrantRes = await apiContext.post('/api/roles/member/desktopRoutes:add', {
        data: [routeId],
      });
      if (!routeGrantRes.ok()) {
        console.warn('grant desktop route to member failed:', routeGrantRes.status(), await routeGrantRes.text());
      }
    }
    const schemaGrantRes = await apiContext.post('/api/roles/member/menuUiSchemas:add', {
      data: [BLOCK_PAGE_SCHEMA_UID],
    });
    if (!schemaGrantRes.ok()) {
      console.warn('grant menu schema to member failed:', schemaGrantRes.status(), await schemaGrantRes.text());
    }
  }

  // 同步本地存储配置到 E2E 环境
  const storageRes = await apiContext.post(
    '/api/storages:update?filter=' + encodeURIComponent(JSON.stringify({ name: 'local' })),
    {
      data: {
        options: { documentRoot: 'storage/uploads-e2e' },
        baseUrl: '/storage/uploads-e2e',
      },
    },
  );
  if (!storageRes.ok()) {
    // eslint-disable-next-line no-console
    console.warn('update storage config failed:', storageRes.status(), await storageRes.text());
  }

  // 确保 member 用户存在
  const existing = await apiContext.get(
    `/api/users:list?filter=${encodeURIComponent(JSON.stringify({ username: MEMBER_USERNAME }))}`,
  );
  const existingData = await existing.json();
  if (!existingData.data?.length) {
    const createRes = await apiContext.post('/api/users:create', {
      data: {
        username: MEMBER_USERNAME,
        nickname: 'E2E Member',
        email: 'e2e_sjgl02_member@nocobase.com',
        password: 'member123',
        roles: [{ name: 'member' }],
      },
    });
    if (!createRes.ok()) {
      const text = await createRes.text();
      // eslint-disable-next-line no-console
      console.warn('create member user failed:', createRes.status(), text);
    }
  }

  // 获取 member token
  const memberSigninRes = await apiContext.post('/api/auth:signIn', {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'e2e_sjgl02_member@nocobase.com', password: 'member123' },
  });
  if (!memberSigninRes.ok()) {
    throw new Error(`member signin failed: ${memberSigninRes.status()} ${await memberSigninRes.text()}`);
  }
  const memberToken = (await memberSigninRes.json()).data?.token;
  if (!memberToken) throw new Error('member token is empty');

  await apiContext.dispose();

  // 使用 admin 上下文访问设置页，确保插件已加载
  const adminContext = await browser.newContext({ storageState: adminAuthFile });
  const adminPage = await adminContext.newPage();
  await adminPage.goto(SETTINGS_URL);
  await expect(adminPage.getByText('Data Management')).toBeVisible();
  await adminContext.close();

  // 使用 member token 创建 member 认证状态
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.goto('/signin');
  await memberPage.evaluate((t) => localStorage.setItem('NOCOBASE_TOKEN', t), memberToken);
  await memberPage.goto(BLOCK_PAGE_URL);
  await expect(memberPage.getByTestId('user-center-button')).toBeVisible({ timeout: 60000 });
  await memberContext.storageState({ path: memberAuthFile });
  await memberContext.close();
});
