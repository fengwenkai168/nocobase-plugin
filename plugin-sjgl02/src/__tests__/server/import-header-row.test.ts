import {
  setupTestApp,
  teardownTestApp,
  createProductCollection,
  loginAs,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelFile, getFixturePath, cleanupFixture, createAttachment } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';

describe('Import Header Row', () => {
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

  it('表头在第 1 行时正常解析', async () => {
    fixturePath = getFixturePath('header-row-1.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price'], [['Apple', 10.5]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'header-row-1.xlsx');
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.headerColumns).toEqual(['name', 'price']);
    expect(res.body.data.totalRows).toBe(1);
  });

  it('表头在第 3 行时跳过前 2 行', async () => {
    fixturePath = getFixturePath('header-row-3.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price'], [['Apple', 10.5]], 3, [
      ['说明行1', ''],
      ['说明行2', ''],
    ]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'header-row-3.xlsx');
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 3 },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.headerColumns).toEqual(['name', 'price']);
    expect(res.body.data.totalRows).toBe(1);
  });

  it('表头行超过数据行时导入成功但无数据', async () => {
    fixturePath = getFixturePath('header-row-empty.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price'], [], 3, [
      ['说明行1', ''],
      ['说明行2', ''],
    ]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'header-row-empty.xlsx');

    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 3,
        fieldMapping: { name: 'name', price: 'price' },
        importMode: 'insert',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const records = await ctx.app.db.getRepository('sjgl02_e2e_products').find();
    expect(records.length).toBe(0);
  });
});
