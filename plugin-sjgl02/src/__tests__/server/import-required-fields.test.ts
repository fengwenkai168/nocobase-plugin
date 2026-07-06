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

describe('Import Required Fields', () => {
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
      importMode: ['insert', 'update', 'upsert'],
    });
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('单个必填字段未映射时拒绝导入', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: true,
      requiredFields: ['name'],
    });

    fixturePath = getFixturePath('missing-name.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['price', 'stock'], [[10.5, 100]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'missing-name.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { price: 'price', stock: 'stock' },
        importMode: 'insert',
      },
    });

    expect(res.status).toBe(400);
  });

  it('单个必填字段数据为空时拒绝导入', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: true,
      requiredFields: ['name'],
    });

    fixturePath = getFixturePath('empty-name.xlsx');
    createExcelFile(
      fixturePath,
      'Sheet1',
      ['name', 'price'],
      [
        ['', 10.5],
        ['Banana', 5],
      ],
    );

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'empty-name.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price' },
        importMode: 'insert',
      },
    });

    expect(res.status).toBe(400);
  });

  it('多个必填字段全部正确时导入成功', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: true,
      requiredFields: ['name', 'category'],
    });

    fixturePath = getFixturePath('multi-required.xlsx');
    createExcelFile(
      fixturePath,
      'Sheet1',
      ['name', 'category', 'price'],
      [
        ['Apple', '水果', 10.5],
        ['Banana', '水果', 5],
      ],
    );

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'multi-required.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', category: 'category', price: 'price' },
        importMode: 'insert',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const records = await ctx.app.db.getRepository('sjgl02_e2e_products').find();
    expect(records.length).toBe(2);
  });

  it('多个必填字段部分缺失时拒绝导入', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: true,
      requiredFields: ['name', 'category'],
    });

    fixturePath = getFixturePath('partial-required.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price'], [['Apple', 10.5]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'partial-required.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price' },
        importMode: 'insert',
      },
    });

    expect(res.status).toBe(400);
  });

  it('必填字段不是唯一值字段时各自校验', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: true,
      importMode: ['update'],
      requiredFields: ['name'],
      uniqueFields: ['code'],
    });

    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Old', code: 'A001', sku: 1001, price: 1 },
    });

    fixturePath = getFixturePath('required-not-unique.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['code', 'name', 'price'], [['A001', 'Apple', 10.5]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'required-not-unique.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { code: 'code', name: 'name', price: 'price' },
        importMode: 'update',
        uniqueFields: ['code'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const record = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { code: 'A001' } });
    expect(record.get('name')).toBe('Apple');
    expect(record.get('price')).toBe(10.5);
  });
});
