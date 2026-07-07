import { formatValue, quoteIdentifier } from './export-worker-utils';
import type { AssociationSheetConfig } from './types';

const PAGE_SIZE = 2000;

export interface AssociationExportOptions {
  sequelize: any;
  workbook: any;
  associationSheets: AssociationSheetConfig[];
  send: (msg: any) => void;
  isCancelled: () => Promise<boolean>;
}

export async function exportAssociationSheets(options: AssociationExportOptions): Promise<void> {
  const { sequelize, workbook, associationSheets, send } = options;
  if (!associationSheets || associationSheets.length === 0) return;

  for (const cfg of associationSheets) {
    if (await options.isCancelled()) return;

    const sheetName = cfg.displayName.substring(0, 31).replace(/[\\/:*?[\]]/g, '_');
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = cfg.targetFields.map((f) => ({
      header: cfg.targetFieldHeaders[f] || f,
      key: f,
      width: Math.max((cfg.targetFieldHeaders[f] || f).length + 4, 20),
    }));
    (sheet.getRow(1) as any).font = { bold: true };
    (sheet.getRow(1) as any).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const quotedTable = quoteIdentifier(cfg.targetTable);
    const quotedFields = cfg.targetFields.map((f) => quoteIdentifier(f)).join(', ');
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const sql = `SELECT ${quotedFields} FROM ${quotedTable} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
      const [rows] = (await sequelize.query(sql)) as any;
      if (rows.length === 0) {
        hasMore = false;
        continue;
      }
      for (const row of rows) {
        const excelRow: Record<string, any> = {};
        for (const f of cfg.targetFields) {
          excelRow[f] = formatValue(row[f]);
        }
        sheet.addRow(excelRow).commit();
      }
      offset += PAGE_SIZE;
      if (rows.length < PAGE_SIZE) hasMore = false;
      send({ type: 'heartbeat', ts: Date.now() });
    }

    sheet.commit();
    send({ type: 'log', level: 'INFO', message: `关联表 ${cfg.targetTable} sheet 导出完成` });
  }
}
