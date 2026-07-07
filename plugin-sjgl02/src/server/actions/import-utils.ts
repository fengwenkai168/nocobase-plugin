import type { Database } from '@nocobase/database';

export interface ImportAsyncParams {
  tableName: string;
  fileId: number;
  sheetName?: string;
  headerRow?: number;
  fieldMapping?: Record<string, string>;
  customValues?: Record<string, any>;
  importMode?: string;
  uniqueFields?: string[];
  blankCellMode?: string;
}

export function quoteIdentifier(name: string): string {
  const DQ = String.fromCharCode(34);
  const DDQ = DQ + DQ;
  return DQ + name.replace(new RegExp(DQ, 'g'), DDQ) + DQ;
}

/**
 * 解析附件在服务器本地文件系统中的真实路径。
 * 优先使用环境变量 LOCAL_STORAGE_DEST，其次使用 storage 记录中配置的 documentRoot，最后使用默认路径。
 */
export async function resolveAttachmentFilePath(db: Database, attachment: any): Promise<string> {
  let documentRoot = process.env.LOCAL_STORAGE_DEST || '';
  if (!documentRoot) {
    try {
      const storageRepo = db.getRepository('storages');
      const storage = await storageRepo.findOne({ filter: { id: attachment.storageId } });
      if (storage) {
        const options = storage.get('options') || {};
        documentRoot = options.documentRoot || '';
      }
    } catch {
      // 忽略存储查询失败
    }
  }
  if (!documentRoot) {
    documentRoot = process.env.STORAGE_DIR || 'storage/uploads';
  }
  const { default: path } = await import('path');
  return path.join(documentRoot, attachment.path || attachment.filename);
}

export async function getPrimaryKeyColumns(sequelize: any, tableName: string): Promise<string[]> {
  try {
    const [rows] = await sequelize.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_name = :tableName
         AND tc.table_schema = current_schema()
       ORDER BY kcu.ordinal_position`,
      { replacements: { tableName }, raw: true },
    );
    return (rows as any[]).map((r: any) => r.column_name);
  } catch {
    return [];
  }
}

export async function prepareShadowPrimaryKey(
  sequelize: any,
  shadowTableName: string,
  pkColumns: string[],
  transaction: any,
): Promise<void> {
  for (const pk of pkColumns) {
    await sequelize.query(
      'ALTER TABLE ' + quoteIdentifier(shadowTableName) + ' ALTER COLUMN ' + quoteIdentifier(pk) + ' DROP NOT NULL',
      { transaction },
    );
  }
}

export async function dropShadowNotNull(
  sequelize: any,
  shadowTableName: string,
  columns: string[],
  transaction: any,
): Promise<void> {
  for (const col of columns) {
    await sequelize.query(
      'ALTER TABLE ' + quoteIdentifier(shadowTableName) + ' ALTER COLUMN ' + quoteIdentifier(col) + ' DROP NOT NULL',
      { transaction },
    );
  }
}

export function resolveMappedDataColumns(
  allColumns: string[],
  mapping: Record<string, string>,
  coll: any,
  pkColumns: string[],
): string[] {
  const autoSystemFields = new Set(['createdAt', 'updatedAt', 'createdById', 'updatedById']);
  const mappedFieldSet = new Set<string>();
  for (const [fieldName, excelCol] of Object.entries(mapping)) {
    if (!excelCol || excelCol === '__ignore__') continue;
    let resolved = fieldName;
    try {
      for (const f of Array.from(coll.fields?.values() || coll.fields || [])) {
        if ((f as any).name === fieldName && (f as any).type === 'belongsTo' && (f as any).options?.foreignKey) {
          resolved = (f as any).options.foreignKey;
          break;
        }
      }
    } catch {
      /* 忽略 */
    }
    mappedFieldSet.add(resolved);
  }
  return allColumns.filter((c) => mappedFieldSet.has(c));
}

export function validateCollectionName(db: Database, name: string): any {
  const coll = db.getCollection(name);
  if (!coll) throw new Error('数据表 ' + name + ' 不存在');
  return coll;
}

export function getAllowedFieldNames(coll: any): Set<string> {
  const set = new Set<string>();
  try {
    for (const f of Array.from(coll.fields?.values() || [])) {
      set.add((f as any).name);
    }
  } catch {
    /* 忽略 */
  }
  return set;
}

export function getFieldType(coll: any, name: string): string {
  try {
    const f = coll.fields instanceof Map ? coll.fields.get(name) : null;
    return (f as any)?.type || 'string';
  } catch {
    return 'string';
  }
}

export function normalizeDateValue(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      val.getFullYear() +
      '-' +
      pad(val.getMonth() + 1) +
      '-' +
      pad(val.getDate()) +
      ' ' +
      pad(val.getHours()) +
      ':' +
      pad(val.getMinutes()) +
      ':' +
      pad(val.getSeconds())
    );
  }
  if (typeof val === 'number') {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + val * 86400000);
    if (!isNaN(d.getTime())) return normalizeDateValue(d);
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return normalizeDateValue(d);
  }
  return null;
}

export function convertValue(raw: any, fieldType: string): any {
  if (raw === null || raw === undefined) return null;
  if (
    fieldType === 'integer' ||
    fieldType === 'bigInt' ||
    fieldType === 'float' ||
    fieldType === 'double' ||
    fieldType === 'decimal' ||
    fieldType === 'number'
  ) {
    if (typeof raw === 'number') return raw;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  if (fieldType === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    if (typeof raw === 'string') {
      const s = raw.trim().toLowerCase();
      if (['true', '1', 'yes', '是'].includes(s)) return true;
      if (['false', '0', 'no', '否'].includes(s)) return false;
    }
    return null;
  }
  if (fieldType === 'json' || fieldType === 'array') {
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return fieldType === 'array' ? raw.split(',').map((s: string) => s.trim()) : raw;
      }
    }
    return raw;
  }
  if (['date', 'datetime', 'datetimeTz', 'unixTimestamp'].includes(fieldType)) {
    return normalizeDateValue(raw);
  }
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}

export function convertRecordValues(record: Record<string, any>, coll: any): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(record)) {
    if (val === undefined) continue;
    if (val === '') {
      const ft = getFieldType(coll, key);
      if (ft !== 'string' && ft !== 'text' && ft !== 'password') {
        result[key] = null;
        continue;
      }
    }
    result[key] = convertValue(val, getFieldType(coll, key));
  }
  return result;
}

export function applyBelongsToFK(
  record: Record<string, any>,
  headers: string[],
  vals: any[],
  mapping: Record<string, string>,
  coll: any,
) {
  const belongs: any[] = [];
  try {
    belongs.push(...Array.from(coll.fields?.values() || coll.fields || []).filter((f: any) => f.type === 'belongsTo'));
  } catch {
    /* 忽略 */
  }
  for (const bf of belongs) {
    const fk = bf.options?.foreignKey || bf.name + 'Id';
    const mappedVal = mapping[bf.name];
    if (mappedVal && mappedVal !== '__ignore__' && mappedVal !== '__custom__') {
      const colIdx = headers.indexOf(mappedVal);
      if (colIdx >= 0 && colIdx < vals.length) {
        record[fk] = vals[colIdx];
      }
      delete record[bf.name];
    }
  }
}

export function makeRecord(
  vals: any[],
  headers: string[],
  mapping: Record<string, string>,
  customValues: Record<string, any>,
): Record<string, any> {
  const record: Record<string, any> = {};
  for (const [tableField, excelCol] of Object.entries(mapping)) {
    if (!excelCol || excelCol === '__ignore__') continue;
    if (excelCol === '__custom__') {
      record[tableField] = customValues[tableField] ?? '';
      continue;
    }
    const colIndex = headers.indexOf(excelCol as string);
    if (colIndex >= 0 && colIndex < vals.length) {
      const raw = vals[colIndex];
      if (raw === undefined || raw === null || raw === '') {
        record[tableField] = '';
        continue;
      }
      record[tableField] = raw;
    } else {
      record[tableField] = '';
    }
  }
  return record;
}

export function buildSnapshot(
  vals: any[],
  headers: string[],
  mapping: Record<string, string>,
  customValues: Record<string, any>,
): string {
  const snap: Record<string, string> = {};
  Object.entries(mapping).forEach(([fieldName, excelCol]) => {
    if (excelCol && excelCol !== '__ignore__') {
      if (excelCol === '__custom__') {
        snap[fieldName + '=(自定义)'] = customValues[fieldName] || '';
      } else {
        const idx = headers.indexOf(excelCol as string);
        if (idx >= 0 && idx < vals.length) snap[excelCol + '→' + fieldName] = String(vals[idx] ?? '');
      }
    }
  });
  return JSON.stringify(snap).substring(0, 500);
}

export function isEmptyRow(vals: any[], headers: string[], mapping: Record<string, string>): boolean {
  for (const excelCol of Object.values(mapping)) {
    if (!excelCol || excelCol === '__ignore__' || excelCol === '__custom__') continue;
    const idx = headers.indexOf(excelCol);
    if (idx >= 0 && idx < vals.length) {
      const v = vals[idx];
      if (v !== undefined && v !== null && v !== '') return false;
    }
  }
  return true;
}

export async function insertBatch(
  sequelize: any,
  quotedShadow: string,
  quotedCols: string,
  dataColumns: string[],
  batch: any[][],
  transaction: any,
) {
  const placeholders = batch
    .map((_, ri) => '(' + dataColumns.map((__, ci) => '$' + (ri * dataColumns.length + ci + 1)).join(', ') + ')')
    .join(', ');
  const flatValues = batch.flat();
  await sequelize.query('INSERT INTO ' + quotedShadow + ' (' + quotedCols + ') VALUES ' + placeholders, {
    bind: flatValues,
    transaction,
  });
}

export async function insertWithSplit(
  sequelize: any,
  quotedShadow: string,
  quotedCols: string,
  dataColumns: string[],
  batch: any[][],
  startOffset: number,
  transaction: any,
): Promise<any[]> {
  const errLogs: any[] = [];
  const SUB_SIZE = Math.max(1, Math.floor(batch.length / 10));
  if (SUB_SIZE === 1) {
    for (let si = 0; si < batch.length; si++) {
      try {
        await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, [batch[si]], transaction);
      } catch (e: any) {
        errLogs.push({
          row: startOffset + si + 1,
          excelRow: 0,
          reason: e.message || String(e),
          snapshot: JSON.stringify(
            dataColumns.reduce((acc: any, c, i) => {
              acc[c] = batch[si][i];
              return acc;
            }, {}),
          ).substring(0, 500),
        });
      }
    }
  } else {
    for (let si = 0; si < batch.length; si += SUB_SIZE) {
      const sub = batch.slice(si, si + SUB_SIZE);
      try {
        await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, sub, transaction);
      } catch {
        const subLogs = await insertWithSplit(
          sequelize,
          quotedShadow,
          quotedCols,
          dataColumns,
          sub,
          startOffset + si,
          transaction,
        );
        errLogs.push(...subLogs);
        if (errLogs.length > 100) break;
      }
    }
  }
  return errLogs;
}
