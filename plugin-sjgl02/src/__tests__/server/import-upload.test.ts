import { setupTestApp, teardownTestApp, createTestCollections, loginAs, saveTablePermission } from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelFile, getFixturePath, cleanupFixture, createAttachment } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';

describe('Import Upload', () => {
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

  it('管理员应该能解析上传的 Excel 文件', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'import.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.headerColumns).toContain('标题');
    expect(res.body.data.totalRows).toBe(2);
    expect(res.body.data.previewRows.length).toBe(2);
  });

  it('普通用户有权限时应该能解析 Excel', async () => {
    const fileId = await createAttachment(ctx.app, fixturePath, 'import.xlsx');
    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.totalRows).toBe(2);
  });

  it('应该支持非第一行表头', async () => {
    const fileWithHeaderOnRow3 = getFixturePath('header-row-3.xlsx');
    createExcelFile(
      fileWithHeaderOnRow3,
      'Sheet1',
      ['标题', '内容'],
      [[], [], ['第一篇文章', '内容1'], ['第二篇文章', '内容2']],
      3,
    );

    const fileId = await createAttachment(ctx.app, fileWithHeaderOnRow3, 'header-row-3.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 3 },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.totalRows).toBe(2);
    cleanupFixture(fileWithHeaderOnRow3);
  });
});
