import {
  setupTestApp,
  teardownTestApp,
  createTestCollections,
  loginAs,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelFile, getFixturePath, cleanupFixture, createAttachment } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';

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

  it('getTaskDetail 返回任务详情', async () => {
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

    const detailRes = await ctx.adminAgent.resource('sjgl02Tasks').getTaskDetail({
      values: { taskId },
    });

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(taskId);
    expect(detailRes.body.data.tableName).toBe('posts');
    expect(detailRes.body.data.taskType).toBe('import');
  });

  it('getTaskDetail 返回 404 当任务不存在', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Tasks').getTaskDetail({
      values: { taskId: 999999 },
    });
    expect(res.status).toBe(404);
  });

  it('cancelTask 取消进行中的任务', async () => {
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
    // 不等待完成，直接取消
    const cancelRes = await ctx.adminAgent.resource('sjgl02Tasks').cancelTask({
      values: { taskId },
    });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.success).toBe(true);

    // 验证任务状态已变为 cancelled
    const task = await ctx.app.db.getRepository('sjgl02_tasks').findOne({ filter: { id: taskId } });
    expect(task.get('status')).toBe('cancelled');
  });

  it('cancelTask 不能取消已完成的任务', async () => {
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

    const cancelRes = await ctx.adminAgent.resource('sjgl02Tasks').cancelTask({
      values: { taskId },
    });

    expect(cancelRes.status).toBe(400);
  });

  it('cancelTask 非所有者不能取消他人任务', async () => {
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
    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const cancelRes = await normalAgent.resource('sjgl02Tasks').cancelTask({
      values: { taskId },
    });

    expect(cancelRes.status).toBe(403);
  });

  it('deleteTask 删除已完成的任务', async () => {
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

    const deleteRes = await ctx.adminAgent.resource('sjgl02Tasks').delete({
      values: { taskId },
    });

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.success).toBe(true);

    // 验证任务已删除
    const task = await ctx.app.db.getRepository('sjgl02_tasks').findOne({ filter: { id: taskId } });
    expect(task).toBeNull();
  });

  it('deleteTask 返回 404 当任务不存在', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Tasks').delete({
      values: { taskId: 999999 },
    });
    expect(res.status).toBe(404);
  });

  it('cancelTask 返回 404 当任务不存在', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Tasks').cancelTask({
      values: { taskId: 999999 },
    });
    expect(res.status).toBe(404);
  });
});
