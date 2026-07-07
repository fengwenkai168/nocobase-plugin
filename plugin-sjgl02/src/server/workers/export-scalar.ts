import ExcelJS from 'exceljs';
import type { WorkerMessage } from './types';
import { formatValue, quoteIdentifier, buildPageSql, formatDateToken } from './export-worker-utils';

const PAGE_SIZE = 2000;
const PROGRESS_INTERVAL = 30000;

export interface ScalarExportOptions {
  sequelize: any;
  tableName: string;
  fieldNames: string[];
  fieldHeaders: Record<string, string>;
  collDisplayName: string;
  pkStrategy: 'cursor' | 'uuid' | 'offset';
  pkField: string | null;
  collectionTotal: number;
  fileNameTemplate?: string;
  tempDir: string;
  send: (msg: WorkerMessage) => void;
  isCancelled: () => Promise<boolean>;
}

export interface ScalarExportResult {
  filePath: string;
  processedRows: number;
  mainIds: (string | number)[];
  streamWriter: any;
}

export async function exportScalarTable(options: ScalarExportOptions): Promise<ScalarExportResult> {
  console.error('[export-scalar] exportScalarTable started');
  const {
    sequelize,
    tableName,
    fieldNames,
    fieldHeaders,
    collDisplayName,
    pkStrategy,
    pkField,
    collectionTotal,
    tempDir,
    fileNameTemplate,
    send,
    isCancelled,
  } = options;

  const path = await import('path');
  const safeName = collDisplayName.substring(0, 31).replace(/[\\/:*?[\]]/g, '_');
  const baseName = fileNameTemplate
    ? fileNameTemplate.replace(/\{表名\}/g, tableName).replace(/\{日期\}/g, formatDateToken())
    : `sjgl02_export_${tableName}_${Date.now()}`;
  const xlsxName = `${baseName}.xlsx`;
  const filePath = path.join(tempDir, xlsxName);

  console.error('[export-scalar] creating workbook writer', filePath);
  const streamWriter = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false,
  });
  console.error('[export-scalar] workbook writer created');
  streamWriter.creator = 'NocoBase @my-project/plugin-sjgl02';

  const sheet = streamWriter.addWorksheet(safeName);
  console.error('[export-scalar] worksheet added', safeName);
  sheet.columns = fieldNames.map((f) => ({
    header: fieldHeaders[f] || f,
    key: f,
    width: Math.max((fieldHeaders[f] || f).length + 4, 20),
  }));
  (sheet.getRow(1) as any).font = { bold: true };
  (sheet.getRow(1) as any).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  const quotedTable = quoteIdentifier(tableName);
  const quotedFields = fieldNames.map((f) => quoteIdentifier(f)).join(', ');
  const selectFields = fieldNames.length > 0 ? quotedFields : '*';
  const effectivePkField = pkStrategy !== 'offset' ? pkField : null;

  let processedRows = 0;
  let lastProgressAt = Date.now();
  const mainIds = new Set<string | number>();
  let lastValue: any = null;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    if (await isCancelled()) {
      throw new Error('cancelled');
    }

    const { sql, bind } = buildPageSql(quotedTable, selectFields, pkField, pkStrategy, lastValue, offset, PAGE_SIZE);
    console.error('[export-scalar] query sql', sql, bind);
    const [rows] = (await sequelize.query(sql, { bind })) as any;
    console.error('[export-scalar] query rows', rows.length);

    if (rows.length === 0) {
      hasMore = false;
      continue;
    }

    for (const row of rows) {
      const excelRow: Record<string, any> = {};
      for (const f of fieldNames) {
        excelRow[f] = formatValue(row[f]);
      }
      sheet.addRow(excelRow).commit();
      processedRows++;
      if (effectivePkField && row[effectivePkField] !== undefined) {
        mainIds.add(row[effectivePkField]);
      }
    }

    if (pkStrategy === 'cursor' || pkStrategy === 'uuid') {
      lastValue = rows[rows.length - 1][pkField as string];
    } else {
      offset += PAGE_SIZE;
      if (offset >= collectionTotal) hasMore = false;
    }

    if (Date.now() - lastProgressAt >= PROGRESS_INTERVAL) {
      const pct = Math.min(100, Math.floor((processedRows / Math.max(1, collectionTotal)) * 100));
      send({ type: 'progress', processedRows, totalRows: collectionTotal, progress: pct });
      send({ type: 'heartbeat', ts: Date.now() });
      lastProgressAt = Date.now();
    }

    if (rows.length < PAGE_SIZE) hasMore = false;
  }

  sheet.commit();
  return { filePath, processedRows, mainIds: Array.from(mainIds), streamWriter };
}
