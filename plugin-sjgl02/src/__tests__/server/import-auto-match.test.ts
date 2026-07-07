import { setupTestApp, teardownTestApp, createProductCollection, loginAs, saveTablePermission } from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelFile, getFixturePath, cleanupFixture, createAttachment } from './helpers/fixtures';
import { MockServer } from '@nocobase/test';

describe('Import Auto Match', () => {
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
    });
  });

  afterEach(async () => {
    cleanupFixture(fixturePath);
    await cleanupShadowTables(ctx.app);
    await cleanupTargetTable(ctx.app, 'sjgl02_e2e_products');
    await cleanupBusinessData(ctx.app);
    await teardownTestApp(ctx.app);
  });

  it('完全同名字段自动匹配', async () => {
    fixturePath = getFixturePath('auto-match-exact.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price', 'stock'], [['Apple', 10.5, 100]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'auto-match-exact.xlsx');
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    expect(res.status).toBe(200);

    const matchRes = await normalAgent.resource('sjgl02Import').autoMatch({
      values: {
        tableName: 'sjgl02_e2e_products',
        excelHeaders: res.body.data.headerColumns,
      },
    });

    expect(matchRes.status).toBe(200);
    expect(matchRes.body.data.mapping.name).toBe('name');
    expect(matchRes.body.data.mapping.price).toBe('price');
    expect(matchRes.body.data.mapping.stock).toBe('stock');
  });

  it('相似名称字段自动匹配', async () => {
    fixturePath = getFixturePath('auto-match-similar.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['Name', 'Price', 'Stock'], [['Apple', 10.5, 100]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'auto-match-similar.xlsx');
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    const matchRes = await normalAgent.resource('sjgl02Import').autoMatch({
      values: {
        tableName: 'sjgl02_e2e_products',
        excelHeaders: res.body.data.headerColumns,
      },
    });

    expect(matchRes.status).toBe(200);
    expect(matchRes.body.data.mapping.Name).toBeDefined();
    expect(matchRes.body.data.mapping.Price).toBeDefined();
  });

  it('部分匹配只返回匹配项', async () => {
    fixturePath = getFixturePath('auto-match-partial.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'unknown_col'], [['Apple', 'x']]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'auto-match-partial.xlsx');
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    const matchRes = await normalAgent.resource('sjgl02Import').autoMatch({
      values: {
        tableName: 'sjgl02_e2e_products',
        excelHeaders: res.body.data.headerColumns,
      },
    });

    expect(matchRes.status).toBe(200);
    expect(matchRes.body.data.mapping.name).toBe('name');
    expect(matchRes.body.data.mapping.unknown_col).toBeFalsy();
  });

  it('无匹配字段时返回空映射', async () => {
    fixturePath = getFixturePath('auto-match-none.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['col_a', 'col_b'], [['x', 'y']]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'auto-match-none.xlsx');
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    const matchRes = await normalAgent.resource('sjgl02Import').autoMatch({
      values: {
        tableName: 'sjgl02_e2e_products',
        excelHeaders: res.body.data.headerColumns,
      },
    });

    expect(matchRes.status).toBe(200);
    expect(Object.keys(matchRes.body.data.mapping).length).toBe(0);
  });

  it('受权限限制的可导入字段只匹配允许字段', async () => {
    await saveTablePermission(ctx.app, ctx.adminAgent, {
      targetType: 'role',
      targetId: ctx.normalRole.get('name'),
      targetName: ctx.normalRole.get('title'),
      tableName: 'sjgl02_e2e_products',
      canImport: true,
      importFields: ['name', 'price'],
    });

    fixturePath = getFixturePath('auto-match-restricted.xlsx');
    createExcelFile(fixturePath, 'Sheet1', ['name', 'price', 'stock'], [['Apple', 10.5, 100]]);

    const normalAgent = await loginAs(ctx.app, ctx.normalUser);
    const fileId = await createAttachment(ctx.app, fixturePath, 'auto-match-restricted.xlsx');
    const res = await normalAgent.resource('sjgl02Import').uploadParse({
      values: { fileId, sheetName: 'Sheet1', headerRow: 1 },
    });

    const matchRes = await normalAgent.resource('sjgl02Import').autoMatch({
      values: {
        tableName: 'sjgl02_e2e_products',
        excelHeaders: res.body.data.headerColumns,
      },
    });

    expect(matchRes.status).toBe(200);
    expect(matchRes.body.data.mapping.name).toBe('name');
    expect(matchRes.body.data.mapping.price).toBe('price');
    expect(matchRes.body.data.mapping.stock).toBeFalsy();
  });
});
