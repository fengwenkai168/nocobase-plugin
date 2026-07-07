import {
  setupTestApp,
  teardownTestApp,
  createTestCollections,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { readExportBuffer } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

describe('Export Association Sheet', () => {
  let ctx: { app: MockServer; adminAgent: any; adminUser: any };

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createTestCollections(ctx.app);

    await ctx.app.db.getRepository('posts').create({
      values: {
        title: '文章1',
        content: '内容1',
        views: 10,
        author: { id: ctx.adminUser.get('id') },
      },
    });

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: 'member',
      targetName: 'member',
      tableName: 'posts',
      canImport: false,
      canExport: true,
      exportFields: ['title', 'content', 'views'],
    });
  });

  afterEach(async () => {
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'posts');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('includeAssociationSheet=true 时导出文件包含关联表 sheet', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'posts',
        selectedFields: ['title', 'content', 'views', 'author'],
        includeAssociationSheet: true,
      },
    });

    expect(res.status).toBe(200);
    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const buffer = await readExportBuffer(ctx.app, task);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    expect(wb.worksheets.length).toBeGreaterThan(1);
    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames.some((name) => name.toLowerCase().includes('users'))).toBe(true);
  });

  it('includeAssociationSheet=false 时只导出主表 sheet', async () => {
    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'posts',
        selectedFields: ['title', 'content', 'views', 'author'],
        includeAssociationSheet: false,
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const buffer = await readExportBuffer(ctx.app, task);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    expect(wb.worksheets.length).toBe(1);
  });
});
