import {
  setupTestApp,
  teardownTestApp,
  createProductCollection,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { MockServer } from '@nocobase/test';

describe('Export Filename Template', () => {
  let ctx: { app: MockServer; adminAgent: any };

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createProductCollection(ctx.app);

    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A001', sku: 1001, price: 10.5 },
    });

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: 'member',
      targetName: 'member',
      tableName: 'sjgl02_e2e_products',
      canImport: false,
      canExport: true,
      exportFields: ['name', 'price'],
    });
  });

  afterEach(async () => {
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('导出生成的文件名包含 taskId 和时间戳', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'price'],
        fileNameTemplate: '{表名}_{日期}.xlsx',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const fileName = task.get('fileName') || '';
    expect(fileName).toMatch(/^sjgl02_e2e_products_\d{14}\.xlsx$/);
  });

  it('导出 Sjgl02 E2E Products 表名正确', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'price'],
        fileNameTemplate: '{表名}.xlsx',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const fileName = task.get('fileName') || '';
    expect(fileName).toBe('sjgl02_e2e_products.xlsx');
  });

  it('导出日期模板正确匹配格式', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'price'],
        fileNameTemplate: '{日期}.xlsx',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const fileName = task.get('fileName') || '';
    expect(fileName).toMatch(/^\d{14}\.xlsx$/);
  });
});
