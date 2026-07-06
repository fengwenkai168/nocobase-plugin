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

describe('Import Modes', () => {
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

  it('insert 模式只新增不更新', async () => {
    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', price: 10.5, stock: 100 },
    });

    fixturePath = getFixturePath('insert.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price', 'stock'], [['Apple', 15, 200]]);

    const fileId = await createAttachment(ctx.app, fixturePath, 'insert.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price', stock: 'stock' },
        importMode: 'insert',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const records = await ctx.app.db.getRepository('sjgl02_e2e_products').find();
    expect(records.length).toBe(2);

    const apple = records.find((r: any) => r.get('name') === 'Apple');
    expect(apple.get('price')).toBe(10.5);
  });

  it('update 模式只更新不新增', async () => {
    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', price: 10.5, stock: 100 },
    });

    fixturePath = getFixturePath('update.xlsx');
    createExcelFile(
      fixturePath,
      'Sheet1',
      ['name', 'price', 'stock'],
      [
        ['Apple', 15, 200],
        ['Banana', 5, 50],
      ],
    );

    const fileId = await createAttachment(ctx.app, fixturePath, 'update.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price', stock: 'stock' },
        importMode: 'update',
        uniqueFields: ['name'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const records = await ctx.app.db.getRepository('sjgl02_e2e_products').find();
    expect(records.length).toBe(1);

    const apple = records.find((r: any) => r.get('name') === 'Apple');
    expect(apple.get('price')).toBe(15);
    expect(apple.get('stock')).toBe(200);
  });

  it('upsert 模式有则更新无则新增', async () => {
    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', price: 10.5, stock: 100 },
    });

    fixturePath = getFixturePath('upsert.xlsx');
    createExcelFile(
      fixturePath,
      'Sheet1',
      ['name', 'price', 'stock'],
      [
        ['Apple', 15, 200],
        ['Banana', 5, 50],
      ],
    );

    const fileId = await createAttachment(ctx.app, fixturePath, 'upsert.xlsx');
    const res = await ctx.adminAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', price: 'price', stock: 'stock' },
        importMode: 'upsert',
        uniqueFields: ['name'],
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const records = await ctx.app.db.getRepository('sjgl02_e2e_products').find();
    expect(records.length).toBe(2);

    const apple = records.find((r: any) => r.get('name') === 'Apple');
    expect(apple.get('price')).toBe(15);

    const banana = records.find((r: any) => r.get('name') === 'Banana');
    expect(banana).toBeTruthy();
  });

  it('无权限使用 update 模式应该被拒绝', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: true,
      importMode: ['insert'],
    });

    fixturePath = getFixturePath('insert.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price'], [['Apple', 15]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'insert.xlsx');
    const res = await normalAgent.resource('sjgl02Import').execute({
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

    expect(res.status).toBe(403);
  });
});
