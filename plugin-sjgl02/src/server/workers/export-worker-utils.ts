import fs from 'fs';
import path from 'path';

export function formatValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(
      val.getMinutes(),
    )}:${pad(val.getSeconds())}`;
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function buildPageSql(
  quotedTable: string,
  quotedFields: string,
  pkField: string | null,
  pkStrategy: 'cursor' | 'uuid' | 'offset',
  lastValue: any,
  offset: number,
  pageSize: number,
): { sql: string; bind: any[] } {
  if ((pkStrategy === 'cursor' || pkStrategy === 'uuid') && pkField) {
    const op = lastValue ? '>' : '>=';
    return {
      sql: `SELECT ${quotedFields} FROM ${quotedTable} WHERE ${quoteIdentifier(pkField)} ${op} $1 ORDER BY ${quoteIdentifier(pkField)} LIMIT ${pageSize}`,
      bind: lastValue ? [lastValue] : [0],
    };
  }
  const orderBy = pkField ? `ORDER BY ${quoteIdentifier(pkField)}` : '';
  return {
    sql: `SELECT ${quotedFields} FROM ${quotedTable} ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`,
    bind: [],
  };
}

export function resolveExportBaseName(tableName: string, fileNameTemplate?: string): string {
  if (fileNameTemplate) {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
      d.getMinutes(),
    )}${pad(d.getSeconds())}`;
    return fileNameTemplate.replace(/\{表名\}/g, tableName).replace(/\{日期\}/g, date);
  }
  return `sjgl02_export_${tableName}_${Date.now()}`;
}

export function formatDateToken(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(
    d.getSeconds(),
  )}`;
}

export interface ZipBuildOptions {
  xlsxPath: string;
  attachments: { id: string | number; filename: string; path: string }[];
  outputPath: string;
  baseName: string;
}

export async function buildExportZip(options: ZipBuildOptions): Promise<string> {
  const { xlsxPath, attachments, outputPath, baseName } = options;

  const archiver = require('archiver');
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 6 } });

  await new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    archive.file(xlsxPath, { name: `${baseName}.xlsx` });

    const storageDir = process.env.STORAGE_DIR || 'storage/uploads';
    for (const att of attachments) {
      if (!att.path) continue;
      const attPath = path.isAbsolute(att.path) ? att.path : path.join(storageDir, att.path);
      if (!fs.existsSync(attPath)) continue;
      archive.file(attPath, { name: `attachments/${att.filename}` });
    }

    archive.finalize();
  });

  return outputPath;
}
