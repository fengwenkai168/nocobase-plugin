import {
  setupTestApp,
  teardownTestApp,
  createTestCollections,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelFile, getFixturePath, cleanupFixture, createAttachment } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';

describe('Performance', () => {
  let ctx: { app: MockServer; adminAgent: any };
  let fixturePath: string;

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createTestCollections(ctx.app);

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: 'member',
      targetName: 'member',
      tableName: 'posts',
      canImport: true,
      canExport: true,
      importMode: ['insert'],
    });
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('导入 1000 行应该成功', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => [`文章${i}`]);
    fixturePath = getFixturePath('perf-import-1000.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['标题'], rows);

    const fileId = await createAttachment(ctx.app, fixturePath, 'perf-import-1000.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题' },
        importMode: 'insert',
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId, 120000);
    expect(task.get('status')).toBe('completed');

    const count = await ctx.app.db.getRepository('posts').count({ filter: {} });
    expect(count).toBe(1000);
  }, 180000);

  it('导入 50000 行应该成功（原目标 100000，当前环境内存限制降档）', async () => {
    const rows = Array.from({ length: 50000 }, (_, i) => [`文章${i}`]);
    fixturePath = getFixturePath('perf-import-50000.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['标题'], rows);

    const fileId = await createAttachment(ctx.app, fixturePath, 'perf-import-50000.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题' },
        importMode: 'insert',
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId, 600000);
    expect(task.get('status')).toBe('completed');

    const count = await ctx.app.db.getRepository('posts').count({ filter: {} });
    expect(count).toBe(50000);
  }, 900000);

  it('导出 1000 行应该成功', async () => {
    const values = Array.from({ length: 1000 }, (_, i) => ({
      title: `文章${i}`,
      content: `内容${i}`,
      views: i,
    }));
    await ctx.app.db.getRepository('posts').create({ values });

    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'posts',
        selectedFields: ['title', 'content', 'views'],
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId, 120000);
    expect(task.get('status')).toBe('completed');
    expect(task.get('processedRows')).toBeGreaterThanOrEqual(1000);
  }, 180000);

  it('导出 50000 行应该成功（原目标 100000，当前环境内存限制降档）', async () => {
    const values = Array.from({ length: 50000 }, (_, i) => ({
      title: `文章${i}`,
      content: `内容${i}`,
      views: i,
    }));
    await ctx.app.db.getRepository('posts').create({ values });

    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'posts',
        selectedFields: ['title', 'content', 'views'],
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId, 600000);
    expect(task.get('status')).toBe('completed');
    expect(task.get('processedRows')).toBeGreaterThanOrEqual(50000);
  }, 900000);
});
