import {
  setupTestApp,
  teardownTestApp,
  createProductCollection,
  loginAs,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelJSFile, getFixturePath, cleanupFixture, createAttachment } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';

describe('Import Switch Sheet', () => {
  let ctx: { app: MockServer; adminAgent: any; normalUser: any; normalRole: any };
  let fixturePath: string;

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createProductCollection(ctx.app);

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: true,
      importMode: ['insert'],
    });
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('多 Sheet 文件解析返回所有 Sheet 名称', async () => {
    fixturePath = getFixturePath('multi-sheet.xlsx');
    await createExcelJSFile(fixturePath, [
      { name: 'Sheet1', headers: ['name', 'price'], rows: [['Apple', 10.5]] },
      { name: 'Sheet2', headers: ['name', 'stock'], rows: [['Banana', 100]] },
      { name: 'Sheet3', headers: ['name', 'category'], rows: [['Cherry', '水果']] },
    ]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'multi-sheet.xlsx');
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.sheetNames).toContain('Sheet1');
    expect(res.body.data.sheetNames).toContain('Sheet2');
    expect(res.body.data.sheetNames).toContain('Sheet3');
  });

  it('切换 Sheet 后表头正确', async () => {
    fixturePath = getFixturePath('multi-sheet.xlsx');
    await createExcelJSFile(fixturePath, [
      { name: 'Sheet1', headers: ['name', 'price'], rows: [['Apple', 10.5]] },
      { name: 'Sheet2', headers: ['name', 'stock'], rows: [['Banana', 100]] },
    ]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'multi-sheet.xlsx');

    const sheet1Res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });
    expect(sheet1Res.body.data.headerColumns).toEqual(['name', 'price']);

    const sheet2Res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet2', headerRow: 1 },
    });
    expect(sheet2Res.body.data.headerColumns).toEqual(['name', 'stock']);
  });

  it('切换 Sheet 后导入正确数据', async () => {
    fixturePath = getFixturePath('multi-sheet.xlsx');
    await createExcelJSFile(fixturePath, [
      { name: 'Sheet1', headers: ['name', 'price'], rows: [['Apple', 10.5]] },
      { name: 'Sheet2', headers: ['name', 'stock'], rows: [['Banana', 100]] },
    ]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'multi-sheet.xlsx');

    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet2',
        headerRow: 1,
        fieldMapping: { name: 'name', stock: 'stock' },
        importMode: 'insert',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const records = await ctx.app.db.getRepository('sjgl02_e2e_products').find();
    expect(records.length).toBe(1);
    expect(records[0].get('name')).toBe('Banana');
    expect(records[0].get('stock')).toBe(100);
  });
});
