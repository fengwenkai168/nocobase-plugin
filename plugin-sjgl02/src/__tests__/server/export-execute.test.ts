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

describe('Export Execute', () => {
  let ctx: { app: MockServer; adminAgent: any; normalUser: any; normalRole: any };

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createTestCollections(ctx.app);

    await ctx.app.db.getRepository('posts').create({
      values: [
        { title: '文章1', content: '内容1', views: 10 },
        { title: '文章2', content: '内容2', views: 20 },
        { title: '文章3', content: '内容3', views: 30 },
      ],
    });

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'posts',
      canImport: false,
      canExport: true,
      exportFields: ['title', 'content', 'views'],
    });
  });

  afterEach(async () => {
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('管理员导出 posts 应该成功生成任务', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'posts',
        selectedFields: ['title', 'content', 'views'],
        fileNameTemplate: '{表名}_{日期}',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.taskId).toBeDefined();

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');
    expect(task.get('tableName')).toBe('posts');
  });

  it('普通用户有导出权限时应该能导出', async () => {
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
