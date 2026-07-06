import { setupTestApp, teardownTestApp, createTestCollections, loginAs, saveTablePermission } from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { MockServer } from '@nocobase/test';

describe('Permission API', () => {
  let ctx: { app: MockServer; adminAgent: any; adminUser: any; normalUser: any; normalRole: any };

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createTestCollections(ctx.app);
  });

  afterEach(async () => {
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  describe('保存权限配置', () => {
    it('管理员保存权限后应该创建 sjgl02_table_permissions 记录', async () => {
      const res = await ctx.adminAgent.resource('sjgl02Permissions').save({
        values: {
          targetType: 'role',
          targetId: ctx.normalRole.get('name'),
          targetName: ctx.normalRole.get('title'),
          permissions: [
            {
              tableName: 'posts',
              canImport: true,
              canExport: false,
              importMode: ['insert'],
              importFields: [],
              exportFields: [],
              uniqueFields: [],
              requiredFields: ['title'],
            },
          ],
        },
      });

      expect(res.status).toBe(200);

      const perms = await ctx.app.db.getRepository('sjgl02_table_permissions').find({
        filter: {
          targetType: 'role',
          targetId: ctx.normalRole.get('name'),
          tableName: 'posts',
        },
      });

      expect(perms.length).toBe(1);
      expect(perms[0].get('canImport')).toBe(true);
      expect(perms[0].get('requiredFields')).toContain('title');
    });

    it('保存权限时应该写入审计日志', async () => {
      const res = await ctx.adminAgent.resource('sjgl02Permissions').save({
        values: {
          targetType: 'role',
          targetId: ctx.normalRole.get('name'),
          targetName: ctx.normalRole.get('title'),
          permissions: [
            {
              tableName: 'posts',
              canImport: true,
              canExport: true,
            },
          ],
        },
      });

      expect(res.status).toBe(200);

      const logs = await ctx.app.db.getRepository('sjgl02_permission_logs').find({
        filter: {
          targetType: 'role',
          targetId: ctx.normalRole.get('name'),
          tableName: 'posts',
        },
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(['create', 'update']).toContain(logs[0].get('action'));
    });
  });

  describe('权限列表查询', () => {
    it('管理员可以查询权限配置', async () => {
      await saveTablePermission(ctx.app, ctx.adminAgent, {
        targetType: 'role',
        targetId: ctx.normalRole.get('name'),
        targetName: ctx.normalRole.get('title'),
        tableName: 'posts',
        canImport: true,
      });

      const res = await ctx.adminAgent.resource('sjgl02Permissions').get({
        values: {
          targetType: 'role',
          targetId: ctx.normalRole.get('name'),
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('越权访问', () => {
    it('普通用户不能保存权限配置', async () => {
      const normalAgent = await loginAs(ctx.app, ctx.normalUser);
      const res = await normalAgent.resource('sjgl02Permissions').save({
        values: {
          targetType: 'role',
          targetId: ctx.normalRole.get('name'),
          targetName: ctx.normalRole.get('title'),
          permissions: [
            {
              tableName: 'posts',
              canImport: true,
            },
          ],
        },
      });

      expect(res.status).toBe(403);
    });
  });
});
