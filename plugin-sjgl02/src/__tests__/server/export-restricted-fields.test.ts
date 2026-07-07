import {
  setupTestApp,
  teardownTestApp,
  createProductCollection,
  loginAs,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { downloadExport } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';
import ExcelJS from 'exceljs';

describe('Export Restricted Fields', () => {
  let ctx: { app: MockServer; adminAgent: any; normalUser: any; normalRole: any };

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createProductCollection(ctx.app);

    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A001', sku: 1001, price: 10.5, stock: 100 },
    });

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
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

  it('限制可导出字段时只导出指定字段', async () => {
    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const res = await normalAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'price', 'stock'],
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const buffer = await downloadExport(normalAgent, task.get('id'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    const headers = ws.getRow(1).values.slice(1) as string[];

    expect(headers).toContain('商品名称(name)');
    expect(headers).toContain('价格(price)');
    expect(headers).not.toContain('库存(stock)');
  });

  it('无导出权限时被拒绝', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: false,
      canExport: false,
    });

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const res = await normalAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name'],
      },
    });

    expect(res.status).toBe(403);
  });
});
