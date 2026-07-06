import { setupTestApp, teardownTestApp, createProductCollection, loginAs, saveTablePermission } from './helpers/setup';
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

describe('Import Unique Fields', () => {
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
      importMode: ['update', 'upsert'],
    });

    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: [
        { name: 'Apple', code: 'A001', sku: 1001, category: '水果', supplier: 'S1', price: 10.5 },
        { name: 'Banana', code: 'B001', sku: 1002, category: '水果', supplier: 'S2', price: 5 },
      ],
    });
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('单字段唯一值更新成功', async () => {
    fixturePath = getFixturePath('unique-single.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price'], [['Apple', 20]]);

    const fileId = await createAttachment(ctx.app, fixturePath, 'unique-single.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price' },
        importMode: 'update',
        uniqueFields: ['name'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const apple = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { name: 'Apple' } });
    expect(apple.get('price')).toBe(20);
  });

  it('双字段组合唯一值更新成功', async () => {
    fixturePath = getFixturePath('unique-combo-2.xlsx');
    createExcelFile(
      fixturePath,
      'Sheet1',
      ['name', 'category', 'price'],
      [
        ['Apple', '水果', 25],
        ['Apple', '干货', 30],
      ],
    );

    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A002', sku: 1003, category: '干货', supplier: 'S3', price: 8 },
    });

    const fileId = await createAttachment(ctx.app, fixturePath, 'unique-combo-2.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', category: 'category', price: 'price' },
        importMode: 'update',
        uniqueFields: ['name', 'category'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const records = await ctx.app.db.getRepository('sjgl02_e2e_products').find({ filter: { name: 'Apple' } });
    expect(records.length).toBe(2);

    const fruitApple = records.find((r: any) => r.get('category') === '水果');
    expect(fruitApple.get('price')).toBe(25);

    const dryApple = records.find((r: any) => r.get('category') === '干货');
    expect(dryApple.get('price')).toBe(30);
  });

  it('三字段组合唯一值更新成功', async () => {
    fixturePath = getFixturePath('unique-combo-3.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'category', 'supplier', 'price'], [['Apple', '水果', 'S1', 35]]);

    const fileId = await createAttachment(ctx.app, fixturePath, 'unique-combo-3.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', category: 'category', supplier: 'supplier', price: 'price' },
        importMode: 'update',
        uniqueFields: ['name', 'category', 'supplier'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const apple = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({
      filter: { name: 'Apple', category: '水果', supplier: 'S1' },
    });
    expect(apple.get('price')).toBe(35);
  });

  it('组合字段部分匹配不更新', async () => {
    fixturePath = getFixturePath('unique-partial.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'category', 'price'], [['Apple', '不存在分类', 99]]);

    const fileId = await createAttachment(ctx.app, fixturePath, 'unique-partial.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', category: 'category', price: 'price' },
        importMode: 'update',
        uniqueFields: ['name', 'category'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const apple = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { name: 'Apple' } });
    expect(apple.get('price')).toBe(10.5);
  });

  it('数字字段作为唯一值更新成功', async () => {
    fixturePath = getFixturePath('unique-code.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['sku', 'price'], [[1001, 40]]);

    const fileId = await createAttachment(ctx.app, fixturePath, 'unique-code.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { sku: 'sku', price: 'price' },
        importMode: 'update',
        uniqueFields: ['sku'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const apple = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { sku: 1001 } });
    expect(apple.get('price')).toBe(40);
  });

  it('未配置唯一值字段时 update 模式失败', async () => {
    fixturePath = getFixturePath('unique-missing.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price'], [['Apple', 20]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'unique-missing.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price' },
        importMode: 'update',
        uniqueFields: [],
      },
    });

    expect(res.status).toBe(400);
  });
});
