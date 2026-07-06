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

describe('Task Lifecycle', () => {
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
      importMode: ['insert'],
    });

    fixturePath = getFixturePath('task-import.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['标题', '内容'], [['任务测试', '任务内容']]);
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('导入任务应该出现在任务列表中', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'task-import.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题', content: '内容' },
        importMode: 'insert',
      },
    });

    const taskId = res.body.data.taskId;
    await waitForTask(ctx.app, taskId);

    const listRes = await ctx.adminAgent.resource('sjgl02Tasks').list({
      values: { taskType: 'import' },
    });

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.length).toBeGreaterThan(0);
    expect(listRes.body.data.items.some((t: any) => t.id === taskId)).toBe(true);
  });

  it('普通用户只能看到自己的任务', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'task-import.xlsx');
    const normalAgent = await loginAs(ctx.app, ctx.normalUser);

    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题', content: '内容' },
        importMode: 'insert',
      },
    });

    const taskId = res.body.data.taskId;
    await waitForTask(ctx.app, taskId);

    const listRes = await normalAgent.resource('sjgl02Tasks').list({});
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.every((t: any) => t.createdById === ctx.normalUser.get('id'))).toBe(true);
  });

  it('非所有者不能删除他人任务', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'task-import.xlsx');
    const adminRes = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题', content: '内容' },
        importMode: 'insert',
      },
    });

    const taskId = adminRes.body.data.taskId;
    await waitForTask(ctx.app, taskId);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const deleteRes = await normalAgent.resource('sjgl02Tasks').delete({
      values: { taskId },
    });

    expect(deleteRes.status).toBe(403);
  });
});
