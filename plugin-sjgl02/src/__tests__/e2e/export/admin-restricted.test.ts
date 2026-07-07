import { test, expect } from '../test';
import {
  clearProducts,
  clearTasks,
  clearPermissions,
  seedProducts,
  waitForTask,
  executeExport,
  readExportRows,
  savePermissions,
  TEST_TABLE,
  MEMBER_ROLE_NAME,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员限制字段导出', () => {
  test.beforeEach(async ({ adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
    await clearPermissions(adminApi);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearTasks(adminApi);
    await clearPermissions(adminApi);
    await clearProducts(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  test('限制 exportFields 后只能导出允许字段', async ({ adminApi }) => {
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
      },
    ]);

    await savePermissions(adminApi, 'role', MEMBER_ROLE_NAME, [
      {
        tableName: TEST_TABLE,
        canImport: true,
        canExport: true,
        importMode: ['insert', 'update', 'upsert'],
        importFields: [],
        exportFields: ['name', 'price'],
        uniqueFields: [],
        requiredFields: [],
      },
    ]);

    const taskId = await executeExport(adminApi, {
      tableName: TEST_TABLE,
      selectedFields: ['name', 'price'],
      permSource: { type: 'role', id: MEMBER_ROLE_NAME },
    });

    const task = await waitForTask(adminApi, taskId, 'completed');
    expect(task.status).toBe('completed');

    const { headers, rows } = await readExportRows(adminApi, taskId);
    expect(headers).toEqual(['商品名称(name)', '价格(price)']);
    expect(rows.length).toBe(1);
    expect(rows[0][0]).toBe('商品A');
    expect(Number(rows[0][1])).toBeCloseTo(9.99, 2);
  });

  test('选择未授权字段时导出被拒绝', async ({ adminApi }) => {
    await savePermissions(adminApi, 'role', MEMBER_ROLE_NAME, [
      {
        tableName: TEST_TABLE,
        canImport: true,
        canExport: true,
        importMode: ['insert', 'update', 'upsert'],
        importFields: [],
        exportFields: ['name'],
        uniqueFields: [],
        requiredFields: [],
      },
    ]);

    const res = await adminApi.post('/api/sjgl02Export:execute', {
      data: {
        tableName: TEST_TABLE,
        selectedFields: ['name', 'code'],
        permSource: { type: 'role', id: MEMBER_ROLE_NAME },
      },
    });

    expect(res.status()).toBe(403);
    const body = await res.text();
    expect(body).toContain('code');
  });
});
