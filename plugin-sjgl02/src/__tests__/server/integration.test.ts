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

describe('Import-Export Integration', () => {
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
      canExport: true,
      importMode: ['insert'],
      exportFields: ['title', 'content', 'views'],
    });

    fixturePath = getFixturePath('integration.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['标题', '内容', '浏览量'], [['集成测试文章', '集成内容', 999]]);
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('完整流程：管理员配置权限 → 普通用户导入 → 普通用户导出', async () => {
    // 1. 普通用户导入
    const fileId = await createAttachment(ctx.app, fixturePath, 'integration.xlsx');
    const normalAgent = await loginAs(ctx.app, ctx.normalUser);

    const importRes = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'posts',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { title: '标题', content: '内容', views: '浏览量' },
        importMode: 'insert',
      },
    });

    expect(importRes.status).toBe(200);
    const importTask = await waitForTask(ctx.app, importRes.body.data.taskId);
    expect(importTask.get('status')).toBe('completed');

    // 2. 验证数据已写入
    const post = await ctx.app.db.getRepository('posts').findOne({
      filter: { title: '集成测试文章' },
    });
    expect(post).toBeTruthy();
    expect(post.get('views')).toBe(999);

    // 3. 普通用户导出
    const exportRes = await normalAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'posts',
        selectedFields: ['title', 'content', 'views'],
      },
    });

    expect(exportRes.status).toBe(200);
    const exportTask = await waitForTask(ctx.app, exportRes.body.data.taskId);
    expect(exportTask.get('status')).toBe('completed');
  });
});
