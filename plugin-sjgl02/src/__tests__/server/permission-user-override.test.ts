import {
  setupTestApp,
  teardownTestApp,
  createTestCollections,
  loginAs,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { MockServer } from '@nocobase/test';

describe('Permission User Override', () => {
  let ctx: { app: MockServer; adminAgent: any; normalUser: any; normalRole: any };

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createTestCollections(ctx.app);

    await ctx.app.db.getRepository('posts').create({
      values: [
        { title: '文章1', content: '内容1', views: 10 },
        { title: '文章2', content: '内容2', views: 20 },
      ],
    });

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'posts',
      canImport: false,
      canExport: false,
    });

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'user',
      targetId: String(ctx.normalUser.get('id')),
      targetName: ctx.normalUser.get('nickname') || ctx.normalUser.get('username'),
      tableName: 'posts',
      canImport: false,
      canExport: true,
      exportFields: ['title', 'content'],
    });
  });

  afterEach(async () => {
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('用户级导出权限覆盖角色级无权限', async () => {
    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const res = await normalAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'posts',
        selectedFields: ['title', 'content'],
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');
  });
});
