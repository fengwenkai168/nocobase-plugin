import { createMockServer, MockServer } from '@nocobase/test';
import { AppSupervisor, Gateway } from '@nocobase/server';

export interface TestContext {
  app: MockServer;
  adminAgent: any;
  adminUser: any;
  normalUser: any;
  normalRole: any;
  restrictedRole: any;
}

/**
 * 创建测试用的 MockServer，并预置用户/角色
 * 使用 .env.test.local 中配置的 nocobase_test 数据库
 */
export async function setupTestApp(options: any = {}): Promise<TestContext> {
  let app: MockServer | undefined;
  try {
    app = await createMockServer({
      plugins: [
        'field-sort',
        'data-source-manager',
        'users',
        'auth',
        'acl',
        'file-manager',
        '@my-project/plugin-sjgl02',
      ],
      acl: true,
      ...options,
    });

    // ACL 中间件 setCurrentRole 需要 systemSettings collection，但测试环境不加载 system-settings 插件
    // 因此手动注册一个最小的 systemSettings collection 并提供默认值
    if (!app.db.hasCollection('systemSettings')) {
      app.db.collection({
        name: 'systemSettings',
        fields: [
          { type: 'string', name: 'title' },
          { type: 'string', name: 'appLang' },
          { type: 'json', name: 'enabledLanguages', defaultValue: ['zh-CN'] },
          { type: 'json', name: 'logo' },
          { type: 'string', name: 'roleMode' },
        ],
      });
      await app.db.sync();
      const existing = await app.db.getRepository('systemSettings').findOne({ filter: { id: 1 } });
      if (!existing) {
        await app.db.getRepository('systemSettings').create({
          values: {
            id: 1,
            title: 'NocoBase',
            appLang: 'zh-CN',
            enabledLanguages: ['zh-CN'],
            roleMode: 'default',
          },
        });
      }
    }

    const db = app.db;

    // 获取管理员
    const adminUser = await db.getRepository('users').findOne({
      filter: { username: 'nocobase' },
    });

    // 创建普通角色
    const normalRole = await db.getRepository('roles').create({
      values: {
        name: 'test-normal-role',
        title: '测试普通角色',
      },
    });

    const restrictedRole = await db.getRepository('roles').create({
      values: {
        name: 'test-restricted-role',
        title: '测试受限角色',
      },
    });

    // 创建普通用户
    const normalUser = await db.getRepository('users').create({
      values: {
        username: 'test-normal-user',
        nickname: '测试普通用户',
        email: 'test-normal@example.com',
        password: 'test123456',
        roles: [{ name: normalRole.get('name') }],
      },
    });

    const adminAgent = await app.agent().login(adminUser);

    return {
      app,
      adminAgent,
      adminUser,
      normalUser,
      normalRole,
      restrictedRole,
    };
  } catch (error) {
    await teardownTestApp(app);
    throw error;
  }
}

/**
 * 彻底销毁 MockServer，释放 AppSupervisor 中的 app 实例
 */
export async function teardownTestApp(app?: MockServer) {
  if (app) {
    try {
      await app.destroy();
    } catch {
      // ignore
    }
  }
  try {
    const supervisor = AppSupervisor.getInstance();
    await supervisor.destroy();
  } catch {
    // ignore
  }
  try {
    Gateway.getInstance().destroy();
  } catch {
    // ignore
  }
}

/**
 * 以指定用户登录获取 agent
 */
export async function loginAs(app: MockServer, user: any) {
  return await app.agent().login(user);
}

/**
 * 创建测试数据表（posts）
 */
export async function createTestCollections(app: MockServer) {
  const collection = app.db.collection({
    name: 'posts',
    createdBy: true,
    updatedBy: true,
    fields: [
      { type: 'string', name: 'title', allowNull: false },
      { type: 'string', name: 'content' },
      { type: 'integer', name: 'views', defaultValue: 0 },
      { type: 'boolean', name: 'published', defaultValue: false },
      {
        type: 'belongsTo',
        name: 'author',
        target: 'users',
        foreignKey: 'authorId',
      },
    ],
  });

  await app.db.sync();
  return collection;
}

/**
 * 为用户/角色保存表级权限
 */
export async function saveTablePermission(
  app: MockServer,
  agent: any,
  options: {
    targetType: 'user' | 'role';
    targetId: string;
    targetName: string;
    tableName: string;
    canImport?: boolean;
    canExport?: boolean;
    importMode?: string[];
    importFields?: string[];
    exportFields?: string[];
    uniqueFields?: string[];
    requiredFields?: string[];
  },
) {
  const res = await agent.resource('sjgl02Permissions').save({
    values: {
      permissions: [
        {
          targetType: options.targetType,
          targetId: options.targetId,
          targetName: options.targetName,
          tableName: options.tableName,
          canImport: options.canImport ?? true,
          canExport: options.canExport ?? true,
          importMode: options.importMode ?? ['insert', 'update', 'upsert'],
          importFields: options.importFields ?? [],
          exportFields: options.exportFields ?? [],
          uniqueFields: options.uniqueFields ?? [],
          requiredFields: options.requiredFields ?? [],
        },
      ],
    },
  });
  return res;
}
