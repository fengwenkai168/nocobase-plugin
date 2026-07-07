import { APIRequestContext, Page, expect } from '@playwright/test';
import { request } from '@playwright/test';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export const SETTINGS_URL = '/admin/settings/sjgl02';
export const BLOCK_PAGE_SCHEMA_UID = 'e2e_sjgl02_block_page_v8';
export const BLOCK_TAB_SCHEMA_UID = 'e2e_sjgl02_grid_tab_v8';
export const BLOCK_PAGE_URL = `/admin/${BLOCK_PAGE_SCHEMA_UID}`;
export const TEST_TABLE = 'sjgl02_e2e_products';
export const TEST_TABLE_TITLE = 'E2E 测试商品';
export const MEMBER_USERNAME = 'e2e_sjgl02_member';
export const MEMBER_ROLE_NAME = 'e2e_sjgl02_member_role';
export const MEMBER_EMAIL = 'e2e_sjgl02_member@nocobase.com';
export const MEMBER_PASSWORD = 'member123';

const ADMIN_EMAIL = 'admin@nocobase.com';
const ADMIN_PASSWORD = 'admin123';
export const ADMIN_AUTH_FILE = path.resolve(__dirname, '.auth', 'admin.auth.json');
export const MEMBER_AUTH_FILE = path.resolve(__dirname, '.auth', 'member.auth.json');
const baseURL = process.env.APP_BASE_URL || 'http://127.0.0.1:20000';

export async function getAdminToken(
  baseURL: string = process.env.APP_BASE_URL || 'http://127.0.0.1:20000',
): Promise<string> {
  const res = await fetch(`${baseURL}/api/auth:signIn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  return data.data?.token;
}

export async function getMemberToken(
  baseURL: string = process.env.APP_BASE_URL || 'http://127.0.0.1:20000',
): Promise<string> {
  const res = await fetch(`${baseURL}/api/auth:signIn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e_sjgl02_member@nocobase.com', password: 'member123' }),
  });
  const data = await res.json();
  return data.data?.token;
}

export async function withAdminContext<T>(callback: (request: APIRequestContext) => Promise<T>): Promise<T> {
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

export async function createExportTaskFromData(api: APIRequestContext, selectedFields: string[]): Promise<number> {
  return executeExport(api, {
    tableName: TEST_TABLE,
    selectedFields,
  });
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/signin?redirect=/admin/settings/sjgl02');
  await page.getByPlaceholder('Username/Email').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function loginAsMember(page: Page) {
  await page.goto('/signin?redirect=/admin/e2e_sjgl02_block_page_v8');
  await page.getByPlaceholder('Username/Email').fill(MEMBER_EMAIL);
  await page.getByPlaceholder('Password').fill(MEMBER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('user-center-button')).toBeVisible();
}

export async function uploadFixture(page: Page, fileName: string) {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('[data-testid="import-file-upload"]').click(),
  ]);
  await fileChooser.setFiles(fixturePath(fileName));
}

export async function readExportRows(
  api: APIRequestContext,
  taskId: number,
): Promise<{ headers: string[]; rows: any[][] }> {
  const res = await api.get(`/api/sjgl02Export:download?taskId=${taskId}`);
  const buffer = await res.body();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const headers = ws.getRow(1).values.slice(1) as string[];
  const rows: any[][] = [];
  ws.eachRow((row, idx) => {
    if (idx > 1) rows.push(row.values.slice(1));
  });
  return { headers, rows };
}

export async function readExportArchiveEntries(
  api: APIRequestContext,
  taskId: number,
): Promise<{ fileName: string; entries: string[] }> {
  const res = await api.get(`/api/sjgl02Export:download?taskId=${taskId}`);
  const buffer = await res.body();
  const tmpFile = path.join('/tmp', `sjgl02_export_${taskId}_${Date.now()}.tar.gz`);
  fs.writeFileSync(tmpFile, buffer);
  try {
    const output = execSync(`tar -tzf ${tmpFile}`, { encoding: 'utf8' });
    const entries = output.split('\n').filter(Boolean);
    const disposition = res.headers()['content-disposition'] || '';
    const match = disposition.match(/filename[^;=\n]*=([^;\n]*)/);
    const fileName = match ? decodeURIComponent(match[1].replace(/['"]/g, '')) : '';
    return { fileName, entries };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore
    }
  }
}

export async function generateImportExcel(
  filePath: string,
  headers: string[],
  rows: Record<string, any>[],
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(headers.map((h) => row[h]));
  }
  await wb.xlsx.writeFile(filePath);
}

export async function uploadBufferToAttachments(
  api: APIRequestContext,
  fileName: string,
  buffer: Buffer,
  mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
): Promise<number> {
  const res = await api.post(`${baseURL}/api/attachments:create`, {
    multipart: {
      file: {
        name: fileName,
        mimeType,
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
