import {
  setupTestApp,
  teardownTestApp,
  createProductCollection,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { downloadExport } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';
import ExcelJS from 'exceljs';

describe('Export Header Style', () => {
  let ctx: { app: MockServer; adminAgent: any };

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createProductCollection(ctx.app);

    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A001', sku: 1001, price: 10.5, stock: 100 },
    });

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: 'member',
      targetName: 'member',
      tableName: 'sjgl02_e2e_products',
      canImport: false,
      canExport: true,
      exportFields: ['name', 'price', 'stock'],
    });
  });

  afterEach(async () => {
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('title_id 格式导出表头为"字段名(字段标识)"', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'price'],
        headerStyle: 'title_id',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    const buffer = await downloadExport(ctx.adminAgent, task.get('id'));

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    const headers = ws.getRow(1).values.slice(1) as string[];

    expect(headers).toContain('商品名称(name)');
    expect(headers).toContain('价格(price)');
  });

  it('title 格式导出表头为"字段名"', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'price'],
        headerStyle: 'title',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    const buffer = await downloadExport(ctx.adminAgent, task.get('id'));

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    const headers = ws.getRow(1).values.slice(1) as string[];

    expect(headers).toContain('商品名称');
    expect(headers).toContain('价格');
  });

  it('id 格式导出表头为"字段标识"', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'price'],
        headerStyle: 'id',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    const buffer = await downloadExport(ctx.adminAgent, task.get('id'));

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    const headers = ws.getRow(1).values.slice(1) as string[];

    expect(headers).toContain('name');
    expect(headers).toContain('price');
  });
});
