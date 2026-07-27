import fs from 'node:fs';
import Excel from 'exceljs';
import * as XLSX from 'xlsx';

export interface SheetMeta {
  name: string;
  rowCount: number;
}

export interface SheetPreview {
  headers: string[];
  rows: unknown[][];
  totalRows: number;
}

export type FileKind = 'xlsx' | 'xls' | 'csv';

// 让出事件循环：大批量行处理时周期性调用，避免长时间阻塞 API 请求（方案 A）
export function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export const ROW_LIMITS: Record<FileKind, number> = {
  xlsx: 500_000,
  xls: 200_000,
  csv: 500_000,
};

export function detectFileKind(fileName: string): FileKind | null {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'xls') return 'xls';
  if (ext === 'csv') return 'csv';
  return null;
}

function normalizeCell(cell: unknown): unknown {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'object') {
    const anyCell = cell as Record<string, unknown>;
    if (anyCell.richText) {
      return (anyCell.richText as Array<{ text: string }>).map((t) => t.text).join('');
    }
    if ('result' in anyCell) return anyCell.result ?? null;
    if (cell instanceof Date) return cell;
    if ('text' in anyCell) return anyCell.text ?? null;
    return String(cell);
  }
  return cell;
}

function rowToArray(rowValues: unknown): unknown[] {
  if (!Array.isArray(rowValues)) return [];
  return rowValues.slice(1).map(normalizeCell);
}

function padRow(values: unknown[], length: number): unknown[] {
  const out = values.slice(0, length);
  while (out.length < length) out.push(null);
  return out;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
    }
  }
  throw lastError;
}

async function listXlsxSheets(filePath: string): Promise<SheetMeta[]> {
  return withRetry(async () => {
    const reader = new Excel.stream.xlsx.WorkbookReader(filePath, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      worksheets: 'emit',
    });
    const sheets: SheetMeta[] = [];
    for await (const worksheet of reader) {
      const ws = worksheet as unknown as { name: string; actualRowCount: number; rowCount: number };
      sheets.push({ name: ws.name, rowCount: ws.actualRowCount || ws.rowCount });
    }
    return sheets;
  });
}

function readBook(filePath: string, kind: FileKind): XLSX.WorkBook {
  if (kind === 'csv') {
    const content = fs.readFileSync(filePath, 'utf8');
    return XLSX.read(content, { type: 'string', cellDates: true });
  }
  return XLSX.readFile(filePath, { cellDates: true });
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];
}

export async function listSheets(filePath: string, kind: FileKind): Promise<SheetMeta[]> {
  if (kind === 'xlsx') return listXlsxSheets(filePath);
  const workbook = readBook(filePath, kind);
  return workbook.SheetNames.map((name) => ({
    name,
    rowCount: sheetRows(workbook, name).length,
  }));
}

export async function readPreview(
  filePath: string,
  kind: FileKind,
  sheetName: string,
  headerRow: number,
  limit = 10,
): Promise<SheetPreview> {
  if (kind === 'xlsx') {
    return withRetry(async () => {
      let headers: string[] = [];
      const rows: unknown[][] = [];
      let totalRows = 0;
      const reader = new Excel.stream.xlsx.WorkbookReader(filePath, {
        entries: 'emit',
        sharedStrings: 'cache',
        hyperlinks: 'ignore',
        styles: 'ignore',
        worksheets: 'emit',
      });
      for await (const worksheet of reader) {
        const ws = worksheet as unknown as { name: string };
        if (ws.name !== sheetName) continue;
        for await (const row of worksheet as AsyncIterable<{ number: number; values: unknown }>) {
          if (row.number === headerRow) {
            headers = rowToArray(row.values).map((v) => (v === null || v === undefined ? '' : String(v)));
          } else if (row.number > headerRow) {
            totalRows += 1;
            if (rows.length < limit) rows.push(rowToArray(row.values));
          }
        }
        break;
      }
      const width = headers.length;
      return { headers, rows: rows.map((r) => padRow(r, width)), totalRows };
    });
  }
  const workbook = readBook(filePath, kind);
  const allRows = sheetRows(workbook, sheetName);
  const headerIdx = Math.max(headerRow - 1, 0);
  const headers = ((allRows[headerIdx] || []) as unknown[]).map((v) =>
    v === null || v === undefined ? '' : String(v),
  );
  const dataRows = allRows.slice(headerIdx + 1);
  return {
    headers,
    rows: dataRows.slice(0, limit).map((r) => padRow(r as unknown[], headers.length)),
    totalRows: dataRows.length,
  };
}

export async function* iterateRows(
  filePath: string,
  kind: FileKind,
  sheetName: string,
  headerRow: number,
): AsyncGenerator<{ rowNumber: number; values: unknown[] }> {
  if (kind === 'xlsx') {
    let width = 0;
    const reader = new Excel.stream.xlsx.WorkbookReader(filePath, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      worksheets: 'emit',
    });
    for await (const worksheet of reader) {
      const ws = worksheet as unknown as { name: string };
      if (ws.name !== sheetName) continue;
      for await (const row of worksheet as AsyncIterable<{ number: number; values: unknown }>) {
        if (row.number === headerRow) {
          width = rowToArray(row.values).length;
          continue;
        }
        if (row.number < headerRow) continue;
        const values = rowToArray(row.values);
        if (values.every((v) => v === null || v === '')) continue;
        yield { rowNumber: row.number, values: padRow(values, width) };
      }
      break;
    }
    return;
  }
  const workbook = readBook(filePath, kind);
  const allRows = sheetRows(workbook, sheetName);
  const headerIdx = Math.max(headerRow - 1, 0);
  const width = ((allRows[headerIdx] || []) as unknown[]).length;
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const values = allRows[i] as unknown[];
    if (!values || values.every((v) => v === null || v === '')) continue;
    yield { rowNumber: i + 1, values: padRow(values, width) };
  }
}

export async function countDataRows(
  filePath: string,
  kind: FileKind,
  sheetName: string,
  headerRow: number,
): Promise<number> {
  let count = 0;
  for await (const _row of iterateRows(filePath, kind, sheetName, headerRow)) {
    count += 1;
  }
  return count;
}
