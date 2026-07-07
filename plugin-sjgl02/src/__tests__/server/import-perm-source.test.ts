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

describe('Import Permission Source', () => {
  let ctx: { app: MockServer; adminAgent: any; normalRole: any; restrictedRole: any };
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

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.restrictedRole.get('name'),
      targetName: ctx.restrictedRole.get('title'),
      tableName: 'posts',
      canImport: false,
    });

    fixturePath = getFixturePath('perm-source.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['标题'], [['文章A']]);
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('admin 切换为 roleA 权限方案时导入成功', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'perm-source.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题' },
        importMode: 'insert',
        permSource: { type: 'role', id: ctx.normalRole.get('name') },
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const posts = await ctx.app.db.getRepository('posts').find();
    expect(posts.length).toBe(1);
  });

  it('admin 切换为 roleB 权限方案时导入被拒绝', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'perm-source.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题' },
        importMode: 'insert',
        permSource: { type: 'role', id: ctx.restrictedRole.get('name') },
      },
    });

    expect(res.status).toBe(403);
  });
});
