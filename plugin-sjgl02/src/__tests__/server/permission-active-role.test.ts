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

describe('Permission Active Role', () => {
  let ctx: { app: MockServer; adminAgent: any; normalUser: any; normalRole: any; restrictedRole: any };
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
      importFields: ['title'],
    });

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.restrictedRole.get('name'),
      targetName: ctx.restrictedRole.get('title'),
      tableName: 'posts',
      canImport: true,
      importMode: ['insert'],
      importFields: ['content'],
    });

    await ctx.app.db.getRepository('rolesUsers').create({
      values: {
        userId: ctx.normalUser.get('id'),
        roleName: ctx.restrictedRole.get('name'),
      },
    });

    fixturePath = getFixturePath('active-role.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['标题', '内容'], [['文章A', '内容A']]);
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('切换为 roleA 后可以导入 title 字段', async () => {
    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'active-role.xlsx');

    const res = await normalAgent.resource('sjgl02Import').execute({
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
  });

  it('切换为 roleB 后导入 title 字段被拒绝', async () => {
    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'active-role.xlsx');

    const res = await normalAgent.resource('sjgl02Import').execute({
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
