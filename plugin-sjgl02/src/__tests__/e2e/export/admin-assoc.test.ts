import { test, expect } from '../test';
import ExcelJS from 'exceljs';
import {
  clearProducts,
  clearTasks,
  seedProducts,
  waitForTask,
  executeExport,
  TEST_TABLE,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

const ASSOC_TABLE = 'sjgl02_e2e_categories';

async function ensureAssocCollection(api: any) {
  const existing = await api.get(
    `/api/collections:list?filter=${encodeURIComponent(JSON.stringify({ name: ASSOC_TABLE }))}`,
  );
  const data = await existing.json();
  if (data.data?.length) return;

  const res = await api.post('/api/collections:create', {
    data: {
      name: ASSOC_TABLE,
      title: 'E2E 测试分类',
      fields: [
        { name: 'title', type: 'string', interface: 'input', required: true, uiSchema: { title: '分类名称' } },
        { name: 'sort', type: 'integer', interface: 'integer', uiSchema: { title: '排序' } },
      ],
    },
  });
  if (!res.ok()) {
    const text = await res.text();
    if (!text.includes('already exists')) {
      throw new Error(`create assoc collection failed: ${res.status()} ${text}`);
    }
  }

  const fieldRes = await api.post('/api/collections:createField', {
    data: {
      collectionName: TEST_TABLE,
      name: 'categoryRel',
      type: 'belongsTo',
      target: ASSOC_TABLE,
      foreignKey: 'categoryRelId',
      interface: 'm2o',
      uiSchema: { title: '关联分类' },
    },
  });
  if (!fieldRes.ok()) {
    const text = await fieldRes.text();
    if (!text.includes('already exists')) {
      throw new Error(`create relation field failed: ${fieldRes.status()} ${text}`);
    }
  }
}

async function cleanupAssocCollection(api: any) {
  try {
    await api.post(`/api/${ASSOC_TABLE}:destroy?filter=${encodeURIComponent(JSON.stringify({ id: { $ne: 0 } }))}`);
  } catch {
    // ignore
  }
  try {
    await api.post('/api/collections:destroyField', {
      data: { collectionName: TEST_TABLE, name: 'categoryRel' },
    });
  } catch {
    // ignore
  }
  try {
    await api.post(`/api/collections:destroy?filter=${encodeURIComponent(JSON.stringify({ name: ASSOC_TABLE }))}`);
  } catch {
    // ignore
  }
}

test.describe('管理员导出关联数据 Sheet', () => {
  test.beforeEach(async ({ adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await ensureAssocCollection(adminApi);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearTasks(adminApi);
    await clearProducts(adminApi);
    await cleanupAssocCollection(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  test('includeAssociationSheet 导出多 Sheet', async ({ adminApi }) => {
    const catRes = await adminApi.post(`/api/${ASSOC_TABLE}:create`, {
      data: [
        { title: '分类A', sort: 1 },
        { title: '分类B', sort: 2 },
      ],
    });
    const catData = await catRes.json();
    const cats = catData.data || [];
    expect(cats.length).toBe(2);

    await seedProducts(adminApi, [
      {
        name: '商品A',
        code: 'A001',
        sku: 1001,
        price: 9.99,
        stock: 10,
        category: '分类1',
        supplier: '供应商A',
        published: true,
        categoryRelId: cats[0].id,
      },
    ]);

    const taskId = await executeExport(adminApi, {
      tableName: TEST_TABLE,
      selectedFields: ['name', 'code', 'categoryRel'],
      includeAssociationSheet: true,
      associationSheetTables: ['categoryRel'],
    });

    await waitForTask(adminApi, taskId, 'completed');

    const res = await adminApi.get(`/api/sjgl02Export:download?taskId=${taskId}`);
    const buffer = await res.body();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    expect(wb.worksheets.length).toBeGreaterThanOrEqual(2);
    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toContain('关联分类-测试分类');

    const mainSheet = wb.worksheets[0];
    const mainHeaders = mainSheet.getRow(1).values.slice(1) as string[];
    expect(mainHeaders).toContain('商品名称(name)');

    const assocSheet = wb.worksheets.find((s) => s.name.includes('测试分类'));
    expect(assocSheet).toBeDefined();
    if (!assocSheet) return;
    const assocHeaders = assocSheet.getRow(1).values.slice(1) as string[];
    expect(assocHeaders).toContain('分类名称(title)');
  });
});
