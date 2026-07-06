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

describe('Import Rollback', () => {
  let ctx: { app: MockServer; adminAgent: any; normalRole: any };
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
      importMode: ['insert'],
    });

    // 创建一个会导致主键冲突的文件：两行的 id 列相同
    fixturePath = getFixturePath('duplicate-pk.xlsx');
    createExcelFile(
      fixturePath,
      'Sheet1',
      ['id', '标题', '内容'],
      [
        [1, '第一篇文章', '内容1'],
        [1, '第二篇文章', '内容2'],
      ],
      1,
    );
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('导入失败时不应写入目标表，且应清理影子表', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'duplicate-pk.xlsx');

    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { id: 'id', title: '标题', content: '内容' },
        importMode: 'insert',
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('failed');

    // 目标表不应有数据
    const posts = await ctx.app.db.getRepository('posts').find();
    expect(posts.length).toBe(0);

    // 影子表应被清理
    const [shadowRows] = await ctx.app.db.sequelize.query(
      "SELECT tablename FROM pg_tables WHERE tablename LIKE '_sjgl02\\_import\\_%' ESCAPE '\\' AND schemaname = current_schema()",
      { raw: true },
    );
    expect((shadowRows as any[]).length).toBe(0);
  });
});
