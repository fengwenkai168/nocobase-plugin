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

describe('Import Blank Cell Handling', () => {
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
      importMode: ['update'],
    });

    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A001', sku: 1001, price: 10.5, stock: 100, category: '水果' },
    });
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('update 模式空单元格保持原值', async () => {
    fixturePath = getFixturePath('blank-update.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price', 'stock'], [['Apple', '', '']]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'blank-update.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price', stock: 'stock' },
        importMode: 'update',
        uniqueFields: ['name'],
        blankCellMode: 'update',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const apple = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { name: 'Apple' } });
    expect(apple.get('price')).toBe(10.5);
    expect(apple.get('stock')).toBe(100);
  });

  it('null 模式空单元格写入 NULL', async () => {
    fixturePath = getFixturePath('blank-null.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price', 'stock'], [['Apple', '', '']]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'blank-null.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price', stock: 'stock' },
        importMode: 'update',
        uniqueFields: ['name'],
        blankCellMode: 'null',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const apple = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { name: 'Apple' } });
    expect(apple.get('price')).toBeNull();
    expect(apple.get('stock')).toBeNull();
  });

  it('skip 模式空单元格跳过不修改', async () => {
    fixturePath = getFixturePath('blank-skip.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price', 'stock'], [['Apple', '', '']]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'blank-skip.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price', stock: 'stock' },
        importMode: 'update',
        uniqueFields: ['name'],
        blankCellMode: 'skip',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const apple = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { name: 'Apple' } });
    expect(apple.get('price')).toBe(10.5);
    expect(apple.get('stock')).toBe(100);
  });
});
