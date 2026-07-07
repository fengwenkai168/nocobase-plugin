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
import * as fs from 'fs';

function createSampleFile(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('Import Attachments', () => {
  let ctx: { app: MockServer; adminAgent: any; normalUser: any; normalRole: any };
  let fixturePath: string;
  let tempFiles: string[] = [];

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
    for (const f of tempFiles) {
      cleanupFixture(f);
    }
    tempFiles = [];
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('导入单附件字段成功', async () => {
    const pngPath = getFixturePath('sample.png');
    createSampleFile(pngPath, 'fake-png-content');
    tempFiles.push(pngPath);

    const coverId = await createAttachment(ctx.app, pngPath, 'sample.png');

    fixturePath = getFixturePath('import-attachment.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'cover'], [['Apple', coverId]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'import-attachment.xlsx');

    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', cover: 'cover' },
        importMode: 'insert',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const record = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { name: 'Apple' } });
    expect(record).toBeTruthy();

    const cover = record.get('cover');
    const coverIdValue = Array.isArray(cover) ? cover[0]?.id : cover?.id;
    expect(coverIdValue).toBe(coverId);
  });

  it('导入多附件字段成功', async () => {
    const txtPath = getFixturePath('sample.txt');
    const pdfPath = getFixturePath('sample.pdf');
    createSampleFile(txtPath, 'fake-txt');
    createSampleFile(pdfPath, 'fake-pdf');
    tempFiles.push(txtPath, pdfPath);

    const file1Id = await createAttachment(ctx.app, txtPath, 'sample.txt');
    const file2Id = await createAttachment(ctx.app, pdfPath, 'sample.pdf');

    fixturePath = getFixturePath('import-multi-attachments.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'files'], [['Apple', `${file1Id},${file2Id}`]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'import-multi-attachments.xlsx');

    const res = await normalAgent.resource('sjgl02Import').execute({
      values: {
        tableName: 'sjgl02_e2e_products',
        fileId,
        sheetName: 'Sheet1',
        headerRow: 1,
        fieldMapping: { name: 'name', files: 'files' },
        importMode: 'insert',
      },
    });

    const task = await waitForTask(ctx.app, res.body.data.taskId);
    expect(task.get('status')).toBe('completed');

    const record = await ctx.app.db.getRepository('sjgl02_e2e_products').findOne({ filter: { name: 'Apple' } });
    const files = record.get('files');
    const fileIds = Array.isArray(files) ? files.map((f: any) => f.id || f) : [];
    expect(fileIds).toContain(file1Id);
    expect(fileIds).toContain(file2Id);
  });
});
