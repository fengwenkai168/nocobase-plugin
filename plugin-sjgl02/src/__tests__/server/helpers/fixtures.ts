import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';

import { MockServer } from '@nocobase/test';

/**
 * 获取本地存储的 storageId
 */
export async function getLocalStorageId(app: MockServer): Promise<number> {
  const storage = await app.db.getRepository('storages').findOne({
    filter: { name: 'local' },
  });
  if (storage) return storage.get('id');

  const created = await app.db.getRepository('storages').create({
    values: {
      name: 'local',
      title: '本地存储',
      type: 'local',
      rules: {},
      path: 'storage/uploads',
      baseUrl: '/storage/uploads',
      options: {},
      default: true,
    },
  });
  return created.get('id');
}

/**
 * 创建测试用附件记录，并把文件复制到 storage 目录
 */
export async function createAttachment(app: MockServer, filePath: string, filename = 'test.xlsx'): Promise<number> {
  const destDir = process.env.LOCAL_STORAGE_DEST || 'storage/uploads-test';
  const destPath = `${destDir}/${Date.now()}-${filename}`;

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(filePath, destPath);

  const storageId = await getLocalStorageId(app);
  const attachment = await app.db.getRepository('attachments').create({
    values: {
      title: filename,
      filename,
      extname: path.extname(filename) || '.xlsx',
      path: destPath.replace(destDir + '/', ''),
      size: fs.statSync(filePath).size,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      storageId,
    },
  });

  return attachment.get('id');
}

/**
 * 生成一个简易的 XLSX 文件（使用 xlsx 库）
 */
export function createExcelFile(
  filePath: string,
  sheetName: string,
  headers: string[],
  rows: any[][],
  headerRow = 1,
  preHeaderRows: any[][] = [],
): string {
  const wsData: any[][] = [];

  // 如果表头不在第一行，前面填入前置行（若有）或空行
  for (let i = 0; i < headerRow - 1; i++) {
    wsData.push(preHeaderRows[i] || []);
  }

  wsData.push(headers);
  rows.forEach((row) => wsData.push(row));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(filePath, buffer as Buffer);

  return filePath;
}

/**
 * 生成一个 CSV 文件
 */
export function createCsvFile(filePath: string, headers: string[], rows: any[][]): string {
  const lines = [headers.join(','), ...rows.map((row) => row.join(','))];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}

/**
 * 使用 exceljs 生成更复杂的 Excel 文件（多 sheet、样式等）
 */
export async function createExcelJSFile(
  filePath: string,
  sheets: { name: string; headers: string[]; rows: any[][] }[],
): Promise<string> {
  const wb = new Workbook();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    ws.addRow(sheet.headers);
    sheet.rows.forEach((row) => ws.addRow(row));
  }

  await wb.xlsx.writeFile(filePath);
  return filePath;
}

/**
 * 获取测试文件路径
 * 使用 /tmp/opencode 作为临时目录（环境已预批准）
 */
export function getFixturePath(filename: string): string {
  const tmpDir = '/tmp/opencode';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return path.join(tmpDir, 'sjgl02-test-' + Date.now() + '-' + filename);
}

/**
 * 清理临时文件
 */
export function cleanupFixture(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

/**
 * 从导出任务中读取文件内容为 Buffer
 */
export async function readExportBuffer(app: MockServer, task: any): Promise<Buffer> {
  const exportFileId = task.get('exportFileId');
  if (!exportFileId) {
    throw new Error('导出任务未生成文件');
  }
  const attachment = await app.db.getRepository('attachments').findOne({
    filter: { id: exportFileId },
  });
  if (!attachment) {
    throw new Error('导出文件附件记录不存在');
  }
  const storageDir = process.env.LOCAL_STORAGE_DEST || process.env.STORAGE_DIR || 'storage/uploads';
  const filePath = path.join(storageDir, attachment.get('path') || attachment.get('filename'));
  return fs.readFileSync(filePath);
}

/**
 * 下载导出文件并返回 Buffer（通过 HTTP agent）
 */
export async function downloadExport(agent: any, taskId: number): Promise<Buffer> {
  const res = await agent.get(`/sjgl02Export:download?taskId=${taskId}`).buffer(true);
  return res.body;
}
