import {
  setupTestApp,
  teardownTestApp,
  createProductCollection,
  saveTablePermission,
  waitForTask,
} from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createAttachment, getFixturePath, cleanupFixture, readExportBuffer } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';

function createSampleFile(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('Export Attachments', () => {
  let ctx: { app: MockServer; adminAgent: any };
  let tempFiles: string[] = [];

  beforeEach(async () => {
    ctx = await setupTestApp();
    await createProductCollection(ctx.app);

    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: 'member',
      targetName: 'member',
      tableName: 'sjgl02_e2e_products',
      canImport: false,
      canExport: true,
      exportFields: ['name', 'cover', 'files'],
    });
  });

  afterEach(async () => {
    for (const f of tempFiles) {
      cleanupFixture(f);
    }
    tempFiles = [];
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('包含附件导出时生成 ZIP 并包含 PNG 文件', async () => {
    const pngPath = getFixturePath('sample.png');
    createSampleFile(pngPath, 'fake-png-content');
    tempFiles.push(pngPath);

    const coverId = await createAttachment(ctx.app, pngPath, 'sample.png');
    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A001', sku: 1001, cover: coverId },
    });

    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'cover'],
        includeAttachments: true,
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const buffer = await readExportBuffer(ctx.app, task);
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.endsWith('.png'))).toBe(true);
  });

  it('包含多个附件时 ZIP 包含所有文件', async () => {
    const pngPath = getFixturePath('sample.png');
    const txtPath = getFixturePath('sample.txt');
    const pdfPath = getFixturePath('sample.pdf');

    createSampleFile(pngPath, 'fake-png');
    createSampleFile(txtPath, 'fake-txt');
    createSampleFile(pdfPath, 'fake-pdf');

    tempFiles.push(pngPath, txtPath, pdfPath);

    const coverId = await createAttachment(ctx.app, pngPath, 'sample.png');
    const file1Id = await createAttachment(ctx.app, txtPath, 'sample.txt');
    const file2Id = await createAttachment(ctx.app, pdfPath, 'sample.pdf');

    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A002', sku: 1002, cover: coverId, files: [file1Id, file2Id] },
    });

    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'cover', 'files'],
        includeAttachments: true,
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const buffer = await readExportBuffer(ctx.app, task);
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);

    expect(entries.some((e) => e.endsWith('.png'))).toBe(true);
    expect(entries.some((e) => e.endsWith('.txt'))).toBe(true);
    expect(entries.some((e) => e.endsWith('.pdf'))).toBe(true);
  });

  it('中文文件名附件在 ZIP 中不乱码', async () => {
    const chinesePath = getFixturePath('中文文件名文档.txt');
    createSampleFile(chinesePath, 'fake-content');
    tempFiles.push(chinesePath);

    const coverId = await createAttachment(ctx.app, chinesePath, '中文文件名文档.txt');
    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A003', sku: 1003, cover: coverId },
    });

    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name', 'cover'],
        includeAttachments: true,
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const buffer = await readExportBuffer(ctx.app, task);
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);

    const hasChineseEntry = entries.some((e) => e.includes('中文'));
    expect(hasChineseEntry).toBe(true);
  });

  it('不包含附件时只导出 Excel', async () => {
    await ctx.app.db.getRepository('sjgl02_e2e_products').create({
      values: { name: 'Apple', code: 'A004', sku: 1004 },
    });

    const res = await ctx.adminAgent.resource('sjgl02Export').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        selectedFields: ['name'],
        includeAttachments: false,
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const buffer = await readExportBuffer(ctx.app, task);
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);

    expect(entries.length).toBe(1);
    expect(entries[0].endsWith('.xlsx')).toBe(true);
  });
});
