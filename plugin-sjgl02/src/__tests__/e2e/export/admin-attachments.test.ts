import { test, expect } from '../test';
import {
  clearProducts,
  clearTasks,
  seedProducts,
  waitForTask,
  executeExport,
  readExportArchiveEntries,
  uploadBufferToAttachments,
  TEST_TABLE,
} from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/admin-api';

test.describe('管理员导出附件 ZIP', () => {
  test.beforeEach(async ({ adminApi }) => {
    await setupE2EEnvironment(adminApi);
    await clearProducts(adminApi);
    await clearTasks(adminApi);
  });

  test.afterEach(async ({ adminApi }) => {
    await clearTasks(adminApi);
    await clearProducts(adminApi);
    await cleanupE2EEnvironment(adminApi);
  });

  test('includeAttachments 导出 ZIP 含附件', async ({ adminApi }) => {
    const buffer = Buffer.from('fake image content');
    const attachmentId = await uploadBufferToAttachments(adminApi, 'test-cover.png', buffer, 'image/png');
    expect(attachmentId).toBeDefined();

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
        cover: [{ id: attachmentId }],
      },
    ]);

    const taskId = await executeExport(adminApi, {
      tableName: TEST_TABLE,
      selectedFields: ['name', 'code', 'cover'],
      includeAttachments: true,
    });

    const task = await waitForTask(adminApi, taskId, 'completed');
    expect(task.status).toBe('completed');

    const res = await adminApi.get(`/api/sjgl02Export:download?taskId=${taskId}`);
    expect(res.headers()['content-type']).toContain('gzip');
    const downloadBuffer = await res.body();
    expect(downloadBuffer.length).toBeGreaterThan(0);

    const { entries } = await readExportArchiveEntries(adminApi, taskId);
    const hasExcel = entries.some((e) => e.endsWith('.xlsx'));
    const hasAttachment = entries.some((e) => e.includes('test-cover.png'));
    expect(hasExcel).toBe(true);
    expect(hasAttachment).toBe(true);
  });
});
