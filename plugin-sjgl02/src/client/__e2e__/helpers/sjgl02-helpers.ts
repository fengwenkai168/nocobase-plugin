import { APIRequestContext, Page } from '@playwright/test';
import { request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export const SETTINGS_URL = '/admin/settings/sjgl02';
export const BLOCK_PAGE_SCHEMA_UID = 'e2e_sjgl02_block_page_v7';
export const BLOCK_TAB_SCHEMA_UID = 'e2e_sjgl02_grid_tab_v7';
export const BLOCK_PAGE_URL = `/admin/${BLOCK_PAGE_SCHEMA_UID}`;
export const TEST_TABLE = 'sjgl02_e2e_products';
export const TEST_TABLE_TITLE = 'E2E 测试商品';
export const MEMBER_USERNAME = 'e2e_sjgl02_member';

const ADMIN_EMAIL = 'admin@nocobase.com';
const ADMIN_PASSWORD = 'admin123';
export const ADMIN_AUTH_FILE = path.resolve(__dirname, '.auth', 'admin.auth.json');
const baseURL = process.env.APP_BASE_URL || 'http://127.0.0.1:20000';

export async function withAdminContext<T>(
  _browser: any,
  callback: (request: APIRequestContext) => Promise<T>,
): Promise<T> {
  const token = await getAdminToken(baseURL);
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  try {
    return await callback(api);
  } finally {
    await api.dispose();
  }
}

export async function getAdminToken(baseURL: string): Promise<string> {
  const res = await fetch(`${baseURL}/api/auth:signIn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  return data.data?.token;
}

export async function ensurePluginEnabled(page: Page) {
  await page.goto(SETTINGS_URL);
  if (page.url().includes(SETTINGS_URL)) return;
  await page.request.post(
    `/api/pm:enable?filterByTk=${encodeURIComponent('@my-project/plugin-sjgl02')}&awaitResponse=true`,
  );
  await page.goto(SETTINGS_URL);
}

export async function seedProducts(api: APIRequestContext, records: any[]) {
  await api.post(`/api/${TEST_TABLE}:create`, { data: records });
}

export async function clearProducts(api: APIRequestContext) {
  try {
    await api.post(`/api/${TEST_TABLE}:destroy?filter=${encodeURIComponent(JSON.stringify({ id: { $ne: 0 } }))}`);
  } catch {
    // ignore
  }
}

export async function clearTasks(api: APIRequestContext) {
  try {
    await api.post(`/api/sjgl02_tasks:destroy?filter=${encodeURIComponent(JSON.stringify({ tableName: TEST_TABLE }))}`);
  } catch {
    // ignore
  }
}

export async function clearPermissions(api: APIRequestContext) {
  try {
    await api.post(
      `/api/sjgl02_table_permissions:destroy?filter=${encodeURIComponent(JSON.stringify({ tableName: TEST_TABLE }))}`,
    );
  } catch {
    // ignore
  }
}

export async function savePermissions(
  api: APIRequestContext,
  targetType: string,
  targetId: string,
  permissions: Record<string, any>[],
) {
  const res = await api.post('/api/sjgl02Permissions:save', {
    data: { targetType, targetId, permissions },
  });
  if (!res.ok()) {
    throw new Error(`save permissions failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

export async function waitForTask(
  api: APIRequestContext,
  taskId: number,
  expectedStatus = 'completed',
  timeout = 120000,
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await api.get(`/api/sjgl02Tasks:detail?taskId=${taskId}`);
    const data = await res.json();
    const task = data.data;
    if (task?.status === expectedStatus) return task;
    if (['failed', 'cancelled'].includes(task?.status)) {
      throw new Error(`Task ${taskId} ended with status ${task.status}: ${task.errorMessage || ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Timeout waiting for task ${taskId} to reach ${expectedStatus}`);
}

export async function getRecordCount(api: APIRequestContext): Promise<number> {
  const res = await api.get(`/api/${TEST_TABLE}:list?pageSize=1`);
  const data = await res.json();
  return data.meta?.count || 0;
}

export async function getRecords(api: APIRequestContext): Promise<any[]> {
  const res = await api.get(`/api/${TEST_TABLE}:list?pageSize=200`);
  const data = await res.json();
  return data.data || [];
}

export async function getLatestTask(api: APIRequestContext, taskType = 'import'): Promise<any> {
  const res = await api.get(`/api/sjgl02Tasks:list?taskType=${taskType}&pageSize=1&sort=-createdAt`);
  const data = await res.json();
  return data.data?.items?.[0] || null;
}

export function fixturePath(name: string): string {
  return path.resolve(__dirname, '..', 'fixtures', name);
}

export async function readExcelBuffer(filePath: string): Promise<Buffer> {
  return fs.readFileSync(filePath);
}

export async function uploadFileToAttachments(api: APIRequestContext, fileName: string): Promise<number> {
  const filePath = fixturePath(fileName);
  const buffer = fs.readFileSync(filePath);

  const res = await api.post(`${baseURL}/api/attachments:create`, {
    multipart: {
      file: {
        name: fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      },
    },
    timeout: 120000,
  });
  if (!res.ok()) {
    throw new Error(`upload failed: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  return data.data?.id;
}

export async function executeImport(api: APIRequestContext, values: Record<string, any>): Promise<number> {
  const res = await api.post('/api/sjgl02Import:execute', { data: values });
  const data = await res.json();
  return data.data?.taskId;
}

export async function executeExport(api: APIRequestContext, values: Record<string, any>): Promise<number> {
  const res = await api.post('/api/sjgl02Export:execute', { data: values });
  const data = await res.json();
  return data.data?.taskId;
}

export async function createImportTaskFromFixture(
  api: APIRequestContext,
  fileName: string,
  mode = 'insert',
  uniqueFields: string[] = [],
): Promise<number> {
  const fileId = await uploadFileToAttachments(api, fileName);
  const parseRes = await api.post('/api/sjgl02Import:uploadParse', {
    data: { fileId, sheetName: 'Sheet1', headerRow: 1 },
  });
  const parseData = await parseRes.json();
  const excelHeaders = parseData.data?.headerColumns || [];
  const fieldMapping: Record<string, string> = {};
  for (const h of excelHeaders) {
    fieldMapping[h] = h;
  }
  return executeImport(api, {
    tableName: TEST_TABLE,
    fileId,
    sheetName: 'Sheet1',
    headerRow: 1,
    fieldMapping,
    customValues: {},
    importMode: mode,
    uniqueFields,
    blankCellMode: 'update',
    permSource: null,
  });
}

export async function createExportTaskFromData(
  api: APIRequestContext,
  selectedFields: string[],
): Promise<number> {
  return executeExport(api, {
    tableName: TEST_TABLE,
    selectedFields,
  });
}
