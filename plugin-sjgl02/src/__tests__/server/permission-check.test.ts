import { setupTestApp, teardownTestApp, createTestCollections, saveTablePermission } from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelFile, getFixturePath, cleanupFixture } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';

describe('permission-check', () => {
  let ctx: { app: MockServer; adminAgent: any; normalUser: any; normalRole: any };

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createTestCollections(ctx.app);

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'posts',
      canImport: true,
      canExport: true,
    });
  });

  afterEach(async () => {
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  describe('checkImportPermission', () => {
    it('管理员有导入权限', async () => {
      const res = await ctx.adminAgent.resource('sjgl02Import').checkImportPermission({
        values: { tableName: 'posts' },
      });
      expect(res.status).toBe(200);
    });

    it('有权限的普通用户可以导入', async () => {
      const normalAgent = await ctx.app.agent().login(ctx.normalUser);
      const res = await normalAgent.resource('sjgl02Import').checkImportPermission({
        values: { tableName: 'posts' },
      });
      expect(res.status).toBe(200);
    });

    it('无权限的普通用户被拒绝', async () => {
      // 创建一个没有权限的用户
      const noPermUser = await ctx.app.db.getRepository('users').create({
        values: {
          username: 'no-perm-user',
          nickname: '无权限用户',
          email: 'noperm@example.com',
          password: 'test123456',
        },
      });
      const noPermAgent = await ctx.app.agent().login(noPermUser);
      const res = await noPermAgent.resource('sjgl02Import').checkImportPermission({
        values: { tableName: 'posts' },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('checkExportPermission', () => {
    it('管理员有导出权限', async () => {
      const res = await ctx.adminAgent.resource('sjgl02Import').checkExportPermission({
        values: { tableName: 'posts' },
      });
      expect(res.status).toBe(200);
    });

    it('有权限的普通用户可以导出', async () => {
      const normalAgent = await ctx.app.agent().login(ctx.normalUser);
      const res = await normalAgent.resource('sjgl02Import').checkExportPermission({
        values: { tableName: 'posts' },
      });
      expect(res.status).toBe(200);
    });

    it('无权限的普通用户被拒绝', async () => {
      const noPermUser = await ctx.app.db.getRepository('users').create({
        values: {
          username: 'no-perm-user-export',
          nickname: '无权限用户导出',
          email: 'noperm-export@example.com',
          password: 'test123456',
        },
      });
      const noPermAgent = await ctx.app.agent().login(noPermUser);
      const res = await noPermAgent.resource('sjgl02Import').checkExportPermission({
        values: { tableName: 'posts' },
      });
      expect(res.status).toBe(403);
    });

    it('切换权限方案后权限变化', async () => {
      const normalAgent = await ctx.app.agent().login(ctx.normalUser);

      // 先确认有权限
      let res = await normalAgent.resource('sjgl02Import').checkExportPermission({
        values: { tableName: 'posts' },
      });
      expect(res.status).toBe(200);

      // 保存新权限（关闭导出）
      await ctx.adminAgent.resource('sjgl02Permissions').save({
        values: {
          permissions: [
            {
              targetType: 'role',
              targetId: ctx.normalRole.get('name'),
              targetName: ctx.normalRole.get('title'),
              tableName: 'posts',
              canImport: true,
              canExport: false,
            },
          ],
        },
      });

      // 再次检查应被拒绝
      res = await normalAgent.resource('sjgl02Import').checkExportPermission({
        values: { tableName: 'posts' },
      });
      expect(res.status).toBe(403);
    });
  });
});
