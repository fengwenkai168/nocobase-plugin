import { setupTestApp, teardownTestApp, createTestCollections, loginAs, saveTablePermission } from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { MockServer } from '@nocobase/test';

describe('PermissionService', () => {
  let ctx: {
    app: MockServer;
    adminAgent: any;
    adminUser: any;
    normalUser: any;
    normalRole: any;
    restrictedRole: any;
  } | null = null;

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createTestCollections(ctx.app);
  });

  afterEach(async () => {
    if (!ctx?.app) return;
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
    ctx = null;
  });

  describe('admin 权限短路', () => {
    it('admin 用户应该拥有完整导入权限', async () => {
      const res = await ctx.adminAgent.resource('sjgl02Import').tableFields({ tableName: 'posts' });
      expect(res.status).toBe(200);
    });

    it('admin 用户应该拥有完整导出权限', async () => {
      const res = await ctx.adminAgent.resource('sjgl02Export').tableFields({ tableName: 'posts' });
      expect(res.status).toBe(200);
    });
  });

  describe('无权限用户', () => {
    it('普通用户无权限时应该被拒绝导入', async () => {
      const normalAgent = await loginAs(ctx.app, ctx.normalUser);
      const res = await normalAgent.resource('sjgl02Import').execute({
        values: { tableName: 'posts', fileId: 99999 },
      });
      expect(res.status).toBe(403);
    });

    it('普通用户无权限时应该被拒绝导出', async () => {
      const normalAgent = await loginAs(ctx.app, ctx.normalUser);
      const res = await normalAgent.resource('sjgl02Export').execute({
        values: { tableName: 'posts', selectedFields: ['title'] },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('角色权限', () => {
    it('为角色配置导入权限后，普通用户应该可以导入', async () => {
      await saveTablePermission(ctx.app, ctx.adminAgent, {
        targetType: 'role',
        targetId: ctx.normalRole.get('name'),
        targetName: ctx.normalRole.get('title'),
        tableName: 'posts',
        canImport: true,
        canExport: false,
      });

      const normalAgent = await loginAs(ctx.app, ctx.normalUser);
      const res = await normalAgent.resource('sjgl02Import').execute({
        values: { tableName: 'posts', fileId: 99999 },
      });
      // 有权限但 fileId 不存在，应返回 404，而非 403
      expect(res.status).toBe(404);
    });

    it('角色只有导入权限时不能导出', async () => {
      await saveTablePermission(ctx.app, ctx.adminAgent, {
        targetType: 'role',
        targetId: ctx.normalRole.get('name'),
        targetName: ctx.normalRole.get('title'),
        tableName: 'posts',
        canImport: true,
        canExport: false,
      });

      const normalAgent = await loginAs(ctx.app, ctx.normalUser);
      const res = await normalAgent.resource('sjgl02Export').execute({
        values: { tableName: 'posts', selectedFields: ['title'] },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('用户权限优先于角色权限', () => {
    it('用户级权限应该覆盖角色级权限', async () => {
      await saveTablePermission(ctx.app, ctx.adminAgent, {
        targetType: 'role',
        targetId: ctx.normalRole.get('name'),
        targetName: ctx.normalRole.get('title'),
        tableName: 'posts',
        canImport: true,
        canExport: false,
      });

      await saveTablePermission(ctx.app, ctx.adminAgent, {
        targetType: 'user',
        targetId: String(ctx.normalUser.get('id')),
        targetName: ctx.normalUser.get('nickname') || ctx.normalUser.get('username'),
        tableName: 'posts',
        canImport: true,
        canExport: true,
      });

      const normalAgent = await loginAs(ctx.app, ctx.normalUser);
      const res = await normalAgent.resource('sjgl02Export').execute({
        values: { tableName: 'posts', selectedFields: ['title'] },
      });
      // 有导出权限，会创建任务，返回 200
      expect(res.status).toBe(200);
    });
  });

  describe('多角色权限合并', () => {
    it('多角色时 importMode 应该取并集', async () => {
      await ctx.app.db.getRepository('rolesUsers').create({
        values: {
          userId: ctx.normalUser.get('id'),
          roleName: ctx.restrictedRole.get('name'),
        },
      });

      await saveTablePermission(ctx.app, ctx.adminAgent, {
        targetType: 'role',
        targetId: ctx.normalRole.get('name'),
        targetName: ctx.normalRole.get('title'),
        tableName: 'posts',
        canImport: true,
        importMode: ['insert'],
      });

      await saveTablePermission(ctx.app, ctx.adminAgent, {
        targetType: 'role',
        targetId: ctx.restrictedRole.get('name'),
        targetName: ctx.restrictedRole.get('title'),
        tableName: 'posts',
        canImport: true,
        importMode: ['update'],
      });

      const plugin = ctx.app.pm.get('@my-project/plugin-sjgl02') as any;
      const perm = await plugin.permissionService.checkPermission(ctx.normalUser.get('id'), 'posts', 'import');

      expect(perm.canImport).toBe(true);
      expect(perm.importMode).toContain('insert');
      expect(perm.importMode).toContain('update');
    });
  });

  describe('字段级权限', () => {
    it('应该限制可导入字段', async () => {
      await saveTablePermission(ctx.app, ctx.adminAgent, {
        targetType: 'role',
        targetId: ctx.normalRole.get('name'),
        targetName: ctx.normalRole.get('title'),
        tableName: 'posts',
        canImport: true,
        importFields: ['title'],
      });

      const plugin = ctx.app.pm.get('@my-project/plugin-sjgl02') as any;
      const perm = await plugin.permissionService.checkPermission(ctx.normalUser.get('id'), 'posts', 'import');

      expect(perm.importFields).toEqual(['title']);
    });
  });
});
