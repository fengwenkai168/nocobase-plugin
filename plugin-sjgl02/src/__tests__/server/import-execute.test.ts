import { setupTestApp, teardownTestApp, createTestCollections, loginAs, saveTablePermission } from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelFile, getFixturePath, cleanupFixture, createAttachment } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';

async function waitForTask(app: MockServer, taskId: number, timeout = 30000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const task = await app.db.getRepository('sjgl02_tasks').findOne({ filter: { id: taskId } });
    if (['completed', 'failed', 'cancelled'].includes(task.get('status'))) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('等待任务完成超时');
}

describe('Import Execute', () => {
  let ctx: { app: MockServer; adminAgent: any; normalUser: any; normalRole: any };
  let fixturePath: string;

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createTestCollections(ctx.app);

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'posts',
      canImport: true,
      importMode: ['insert', 'update', 'upsert'],
    });

    fixturePath = getFixturePath('import.xlsx');
    createExcelFile(
      fixturePath,
      'Sheet1',
      ['标题', '内容', '浏览量'],
      [
        ['第一篇文章', '内容1', 100],
        ['第二篇文章', '内容2', 200],
      ],
    );
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('insert 模式应该导入新记录', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'import.xlsx');

    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题', content: '内容', views: '浏览量' },
        importMode: 'insert',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.taskId).toBeDefined();

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const posts = await ctx.app.db.getRepository('posts').find();
    expect(posts.length).toBe(2);
    expect(posts.map((p: any) => p.get('title'))).toContain('第一篇文章');
  });

  it('update 模式应该按唯一值更新记录', async () => {
    await ctx.app.db.getRepository('posts').create({
      values: { title: '第一篇文章', content: '旧内容', views: 0 },
    });

    const fileId = await createAttachment(ctx.app, fixturePath, 'import.xlsx');

    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题', content: '内容', views: '浏览量' },
        importMode: 'update',
        uniqueFields: ['title'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const post = await ctx.app.db.getRepository('posts').findOne({
      filter: { title: '第一篇文章' },
    });
    expect(post.get('content')).toBe('内容1');
    expect(post.get('views')).toBe(100);
  });

  it('必填字段缺失应该失败', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'posts',
      canImport: true,
      requiredFields: ['title'],
    });

    const fileWithMissingTitle = getFixturePath('missing-title.xlsx');
    createExcelFile(fileWithMissingTitle, 'Sheet1', ['内容', '浏览量'], [['内容1', 100]], 1);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fileWithMissingTitle, 'missing-title.xlsx');

    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { content: '内容', views: '浏览量' },
        importMode: 'insert',
      },
    });

    expect(res.status).toBe(400);
    cleanupFixture(fileWithMissingTitle);
  });
});
