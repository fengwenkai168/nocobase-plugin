import { Context, Next } from '@nocobase/actions';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { checkImportPermission } from './permission-check';
import { writeTaskLog } from './taskLogs';
import { cancelFlags } from './cancel-state';
import type { Database } from '@nocobase/database';

interface ImportAsyncParams {
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

function quoteIdentifier(name: string): string {
  const DQ = String.fromCharCode(34);
  const DDQ = DQ + DQ;
  return DQ + name.replace(new RegExp(DQ, 'g'), DDQ) + DQ;
}

/**
 * 解析附件在服务器本地文件系统中的真实路径。
 * 优先使用环境变量 LOCAL_STORAGE_DEST，其次使用 storage 记录中配置的 documentRoot，最后使用默认路径。
 */
async function resolveAttachmentFilePath(db: Database, attachment: any): Promise<string> {
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
  return path.join(documentRoot, attachment.path || attachment.filename);
}

async function getPrimaryKeyColumns(sequelize: any, tableName: string): Promise<string[]> {
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

async function prepareShadowPrimaryKey(
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

async function dropShadowNotNull(
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

function resolveMappedDataColumns(
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
  const autoPkSet = new Set(pkColumns);
  const result = allColumns.filter((c) => {
    if (mappedFieldSet.has(c)) return true;
    // 未映射的系统字段和主键字段不写入影子表，由数据库默认值或阶段三逻辑填充
    if (autoSystemFields.has(c)) return false;
    if (autoPkSet.has(c)) return false;
    return false;
  });
  return result;
}

function validateCollectionName(db: Database, name: string): any {
  const coll = db.getCollection(name);
  if (!coll) throw new Error('数据表 ' + name + ' 不存在');
  return coll;
}

function getAllowedFieldNames(coll: any): Set<string> {
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

function getFieldType(coll: any, name: string): string {
  try {
    const f = coll.fields instanceof Map ? coll.fields.get(name) : null;
    return (f as any)?.type || 'string';
  } catch {
    return 'string';
  }
}

function normalizeDateValue(val: any): string | null {
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

function convertValue(raw: any, fieldType: string): any {
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

function convertRecordValues(record: Record<string, any>, coll: any): Record<string, any> {
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

function applyBelongsToFK(
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

function makeRecord(
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

function buildSnapshot(
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

function isEmptyRow(vals: any[], headers: string[], mapping: Record<string, string>): boolean {
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

// __HELPERS_PLACEHOLDER__

export async function getTableFields(ctx: Context, next: Next) {
  const { tableName } = ctx.action.params;
  if (!tableName || tableName === '__all__') {
    ctx.body = [];
    await next();
    return;
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, 'Table ' + tableName + ' not found');
  }
  let rawFields: any[] = [];
  try {
    rawFields = Array.from(coll.fields?.values() || coll.fields || []);
  } catch {
    rawFields = [];
  }
  const autoFields = ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'createdById', 'updatedById'];
  const fkSet = new Set<string>();
  rawFields.forEach((f: any) => {
    if (f.type === 'belongsTo' && f.options?.foreignKey) {
      fkSet.add(f.options.foreignKey);
    }
  });
  const fields = rawFields
    .filter((f: any) => {
      return f.name !== 'createdBy' && f.name !== 'updatedBy';
    })
    .map((f: any) => {
      let title = f.options?.uiSchema?.title || null;
      if (title && /^\{\{/.test(title)) title = null;
      if (!title) title = f.name;
      return {
        name: f.name,
        type: f.type,
        target: f.target || null,
        uiSchema: { ...(f.options?.uiSchema || {}), title },
        interface: f.options?.interface || null,
        isRequired: autoFields.includes(f.name) ? false : f.options?.allowNull === false,
        isRelation: ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type),
        isForeignKey: fkSet.has(f.name),
      };
    });
  ctx.body = fields;
  await next();
}

async function streamProcessExcel(
  filePath: string,
  targetSheet: string | undefined,
  headerRow: number,
  onRow: (excelRowNum: number, dataIndex: number, rowValues: any[]) => boolean | void | Promise<boolean | void>,
  onHeader?: (headers: string[]) => void,
): Promise<{ headers: string[]; totalRows: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = targetSheet ? wb.getWorksheet(targetSheet) : wb.worksheets[0];
  if (!ws) {
    throw new Error('工作表未找到: ' + (targetSheet || '默认工作表'));
  }

  const hRowNum = headerRow || 1;
  let headers: string[] = [];
  let dataIndex = 0;
  let totalRows = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const rowValues = (row.values as any[]) || [];
    if (rowNum < hRowNum) return;
    if (rowNum === hRowNum) {
      headers = rowValues.slice(1).map((h: any) => String(h ?? ''));
      if (onHeader) onHeader(headers);
      return;
    }
    const vals = rowValues.slice(1);
    const empty = !vals.some((v: any) => v !== undefined && v !== null && v !== '');
    if (empty) {
      dataIndex++;
      return;
    }
    totalRows++;
    const shouldContinue = onRow(rowNum, dataIndex, vals);
    if (shouldContinue === false) return false;
    dataIndex++;
  });

  return { headers, totalRows };
}

export async function uploadParse(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { fileId, sheetName, headerRow } = params;
  if (!fileId) {
    ctx.throw(400, 'fileId is required');
  }
  try {
    const attachRepo = ctx.db.getRepository('attachments');
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      ctx.throw(404, 'File not found in storage');
    }
    const ext = (attachment.extname || '').toLowerCase().replace('.', '');
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      ctx.throw(400, 'Unsupported format: ' + ext + '. Only .xlsx, .xls, .csv allowed');
    }
    const filePath = await resolveAttachmentFilePath(ctx.db, attachment);
    if (!fs.existsSync(filePath)) {
      ctx.throw(404, 'File not found on disk');
    }

    const rawRows: any[][] = [];
    let headerColumns: string[] = [];
    let totalRows = 0;

    let sheets: string[] = [sheetName || 'Sheet1'];
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);
      sheets = wb.worksheets.map((ws: any) => ws.name);
    } catch {
      /* 忽略 */
    }

    await streamProcessExcel(
      filePath,
      sheetName,
      parseInt(String(headerRow), 10) || 1,
      (rowNum, dataIdx, vals) => {
        if (dataIdx < 0) return true;
        if (dataIdx < 10) rawRows.push(vals);
        return dataIdx < 10;
      },
      (headers) => {
        headerColumns = headers;
      },
    ).then((result) => {
      if (headerColumns.length === 0) headerColumns = result.headers;
      totalRows = result.totalRows;
    });

    const previewRows = rawRows.map((vals) => {
      const obj: Record<string, any> = {};
      headerColumns.forEach((h, i) => {
        obj[h] = vals[i] !== undefined ? vals[i] : '';
      });
      return obj;
    });

    ctx.body = {
      sheets,
      headerColumns,
      fileId,
      fileName: attachment.filename || attachment.title,
      previewRows,
      totalRows,
    };
  } catch (err: any) {
    console.error('uploadParse 异常:', err.stack || err.message || String(err));
    if (err.status) throw err;
    ctx.throw(500, 'Failed to parse file: ' + err.message);
  }
  await next();
}

export async function preview(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const fileId = params.fileId || ctx.request.query?.fileId || ctx.query?.fileId;
  const sheetName = params.sheetName || ctx.request.query?.sheetName;
  const headerRow = params.headerRow || ctx.request.query?.headerRow;
  const previewLimit = parseInt(params.previewLimit || ctx.request.query?.previewLimit || '10', 10) || 10;
  if (!fileId) {
    ctx.throw(400, 'fileId is required');
  }
  try {
    const attachRepo = ctx.db.getRepository('attachments');
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      ctx.throw(404, 'Uploaded file not found in storage');
    }
    const ext = (attachment.extname || '').toLowerCase().replace('.', '');
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      ctx.throw(400, 'Unsupported format: ' + ext + '. Only .xlsx, .xls, .csv allowed');
    }
    const filePath = await resolveAttachmentFilePath(ctx.db, attachment);
    if (!fs.existsSync(filePath)) {
      ctx.throw(404, 'File not found on disk: ' + filePath);
    }

    const rawRows: any[] = [];
    let columns: string[] = [];
    let totalRows = 0;

    const hRow = parseInt(String(headerRow), 10) || 1;
    await streamProcessExcel(
      filePath,
      sheetName,
      hRow,
      (rowNum, dataIdx, vals) => {
        if (dataIdx < 0) return true;
        if (dataIdx < previewLimit) rawRows.push(vals);
        return dataIdx < previewLimit;
      },
      (headers) => {
        columns = headers;
      },
    ).then((result) => {
      if (columns.length === 0) columns = result.headers;
      totalRows = result.totalRows;
    });

    const previewRows = rawRows.map((vals) => {
      const obj: Record<string, any> = {};
      columns.forEach((h, i) => {
        obj[h] = vals[i] !== undefined ? vals[i] : '';
      });
      return obj;
    });

    ctx.body = {
      preview: previewRows,
      totalRows,
      columns,
    };
  } catch (err: any) {
    if (err.status) throw err;
    ctx.throw(500, 'Failed to preview file: ' + err.message);
  }
  await next();
}

export async function executeImport(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const {
    tableName,
    fileId,
    sheetName,
    headerRow,
    fieldMapping,
    customValues,
    importMode,
    uniqueFields,
    blankCellMode,
    permSource,
  } = params;
  if (!tableName || !fileId) {
    ctx.throw(400, 'tableName and fileId are required');
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, 'Table ' + tableName + ' not found');
  }

  const perm = await checkImportPermission(ctx, tableName, permSource);
  const effectiveImportMode = importMode || 'insert';

  if (perm.importMode.length > 0 && !perm.importMode.includes(effectiveImportMode)) {
    ctx.throw(
      403,
      '您的权限不允许使用「' +
        effectiveImportMode +
        '」模式导入数据表「' +
        tableName +
        '」，允许的模式：' +
        perm.importMode.join('、'),
    );
  }

  const allowedImportFields = perm.importFields || [];
  if (allowedImportFields.length > 0 && fieldMapping) {
    for (const tableField of Object.keys(fieldMapping)) {
      if (!allowedImportFields.includes(tableField)) {
        ctx.throw(403, '您的权限不允许导入字段「' + tableField + '」，请联系管理员');
      }
    }
  }

  const requiredPermFields = perm.requiredFields || [];
  if (requiredPermFields.length > 0 && fieldMapping) {
    for (const rf of requiredPermFields) {
      const mappedTo = fieldMapping[rf];
      if (!mappedTo || mappedTo === '__ignore__') {
        ctx.throw(400, '必填字段「' + rf + '」未在字段映射中配置');
      }
    }
  }

  const attachRepo = ctx.db.getRepository('attachments');
  const attachment = await attachRepo.findOne({ filter: { id: fileId } });
  if (!attachment) {
    ctx.throw(404, 'Uploaded file not found');
  }
  const ext = (attachment.extname || '').toLowerCase().replace('.', '');
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    ctx.throw(400, 'Unsupported file format. Only .xlsx, .xls, .csv allowed');
  }

  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.create({
    values: {
      taskType: 'import',
      tableName,
      status: 'pending',
      fieldMapping: fieldMapping || {},
      customValues: customValues || {},
      importMode: effectiveImportMode,
      sheetName: sheetName || 'Sheet1',
      headerRow: headerRow || 1,
      importFileId: fileId,
      fileName: attachment.filename || attachment.title || '',
      uniqueFields: uniqueFields || [],
      totalRows: 0,
      progress: 0,
      createdById: ctx.state.currentUser?.id,
      blankCellMode: blankCellMode || 'update',
    },
  });

  const db = ctx.db;
  const taskId = task.id;

  ctx.body = { taskId };
  await next();

  setImmediate(() => {
    processImportAsync(db, taskId, {
      tableName,
      fileId,
      sheetName,
      headerRow,
      fieldMapping,
      customValues,
      importMode,
      uniqueFields,
      blankCellMode,
    });
  });
}

async function processImportAsync(db: Database, taskId: number, params: ImportAsyncParams) {
  const {
    tableName,
    sheetName,
    headerRow,
    fieldMapping,
    customValues,
    importMode,
    uniqueFields,
    blankCellMode,
    fileId,
  } = params;
  const repo = db.getRepository('sjgl02_tasks');
  const sequelize = db.sequelize;

  let userId: number | null = null;
  try {
    const taskRec = await repo.findOne({ filter: { id: taskId }, raw: true });
    userId = (taskRec as any)?.createdById || null;
  } catch {
    /* 忽略 */
  }

  const mapping = fieldMapping || {};
  const custVals = customValues || {};
  const uFields = uniqueFields || [];
  const hRow = parseInt(String(headerRow), 10) || 1;
  const bCellMode = blankCellMode || 'update';
  const mode = importMode || 'insert';

  let coll: any;
  try {
    coll = validateCollectionName(db, tableName);
  } catch (err: any) {
    await fail(taskId, db, '数据表不存在: ' + err.message);
    return;
  }

  const allowedFieldSet = getAllowedFieldNames(coll);
  for (const key of Object.keys(mapping)) {
    if (!allowedFieldSet.has(key)) {
      await fail(taskId, db, '字段 ' + key + ' 不存在于数据表 ' + tableName);
      return;
    }
  }
  for (const uf of uFields) {
    if (!allowedFieldSet.has(uf)) {
      await fail(taskId, db, '唯一值字段 ' + uf + ' 不存在');
      return;
    }
  }

  let filePath = '';
  try {
    const attachRepo = db.getRepository('attachments');
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      await fail(taskId, db, '附件记录未找到: ' + fileId);
      return;
    }
    filePath = await resolveAttachmentFilePath(db, attachment);
  } catch (err: any) {
    await fail(taskId, db, '解析文件路径失败: ' + (err.message || String(err)));
    return;
  }
  if (!fs.existsSync(filePath)) {
    await fail(taskId, db, '文件未找到: ' + filePath);
    return;
  }

  let shadowTableName = '';
  let errorLogs: any[] = [];
  let phase1TotalRows = 0;
  let phase1Headers: string[] = [];
  let phase2TotalRows = 0;

  try {
    await repo.update({ filterByTk: taskId, values: { status: 'processing' } });
    await writeTaskLog(db, taskId, 'INFO', '开始执行导入任务');
    await writeTaskLog(db, taskId, 'INFO', '目标数据表: ' + tableName);
    await writeTaskLog(db, taskId, 'INFO', '导入模式: ' + mode);

    const pkColumns = await getPrimaryKeyColumns(sequelize, tableName);
    if (pkColumns.length === 0) {
      throw new Error('数据表 ' + tableName + ' 没有主键，无法导入');
    }

    await writeTaskLog(db, taskId, 'INFO', '阶段一：流式预校验开始...');
    errorLogs = [];
    const seenUniqueValues = new Set<string>();
    const seenPkValues = new Set<string>();
    let phase1Cancelled = false;

    const phase1Result = await new Promise<{ passed: boolean; headers: string[]; totalRows: number }>(
      (resolve, reject) => {
        streamProcessExcel(
          filePath,
          sheetName,
          hRow,
          (rowNum, dataIdx, vals) => {
            if (cancelFlags.has(taskId)) {
              phase1Cancelled = true;
              return false;
            }
            if (dataIdx < 0) return true;
            if (isEmptyRow(vals, phase1Headers, mapping)) return true;

            const record = makeRecord(vals, phase1Headers, mapping, custVals);

            if ((mode === 'update' || mode === 'upsert') && uFields.length > 0) {
              const emptyUFields = uFields.filter(
                (uf) => record[uf] === undefined || record[uf] === '' || record[uf] === null,
              );
              if (emptyUFields.length > 0) {
                if (errorLogs.length < 1000) {
                  errorLogs.push({
                    row: dataIdx + 1,
                    excelRow: rowNum,
                    reason: '唯一值字段为空（' + emptyUFields.join(', ') + '）',
                    snapshot: buildSnapshot(vals, phase1Headers, mapping, custVals),
                  });
                }
              } else {
                const ufKey = uFields.map((uf) => record[uf]).join('||');
                if (seenUniqueValues.has(ufKey)) {
                  if (errorLogs.length < 1000) {
                    errorLogs.push({
                      row: dataIdx + 1,
                      excelRow: rowNum,
                      reason: 'Excel 内部唯一值重复: ' + uFields.join('+') + ' = ' + ufKey,
                      snapshot: buildSnapshot(vals, phase1Headers, mapping, custVals),
                    });
                  }
                } else {
                  seenUniqueValues.add(ufKey);
                }
              }
            }

            for (const pk of pkColumns) {
              if (mapping[pk] && mapping[pk] !== '__ignore__') {
                const pkVal = record[pk];
                if (pkVal !== undefined && pkVal !== '' && pkVal !== null) {
                  const pkKey = String(pkVal);
                  if (seenPkValues.has(pkKey)) {
                    if (errorLogs.length < 1000) {
                      errorLogs.push({
                        row: dataIdx + 1,
                        excelRow: rowNum,
                        reason: 'Excel 内部主键重复: ' + pk + ' = ' + pkKey,
                        snapshot: buildSnapshot(vals, phase1Headers, mapping, custVals),
                      });
                    }
                  } else {
                    seenPkValues.add(pkKey);
                  }
                }
              }
            }

            return true;
          },
          (headers) => {
            phase1Headers = headers;
          },
        )
          .then((result) => {
            resolve({
              passed: !phase1Cancelled && errorLogs.length === 0,
              headers: result.headers,
              totalRows: result.totalRows,
            });
          })
          .catch(reject);
      },
    );

    phase1Headers = phase1Result.headers;
    phase1TotalRows = phase1Result.totalRows;

    if (phase1Cancelled) {
      await writeTaskLog(db, taskId, 'WARN', '任务已取消（阶段一）');
      cancelFlags.delete(taskId);
      await repo.update({ filterByTk: taskId, values: { status: 'cancelled', completedAt: new Date() } });
      return;
    }

    await repo.update({ filterByTk: taskId, values: { totalRows: phase1TotalRows } });
    await writeTaskLog(db, taskId, 'SUCC', '阶段一预校验完成，共 ' + phase1TotalRows + ' 行有效数据');

    if (!phase1Result.passed) {
      await writeTaskLog(db, taskId, 'ERROR', '阶段一预校验失败，共 ' + errorLogs.length + ' 个错误');
      await repo.update({
        filterByTk: taskId,
        values: {
          status: 'failed',
          errorLogs,
          errorMessage: '预校验失败: ' + errorLogs.length + ' 个错误',
          completedAt: new Date(),
        },
      });
      return;
    }

    await writeTaskLog(db, taskId, 'INFO', '阶段二：影子表写入开始...');
    shadowTableName = '_sjgl02_import_' + taskId;
    const quotedMain = quoteIdentifier(tableName);
    const quotedShadow = quoteIdentifier(shadowTableName);

    const transaction = await sequelize.transaction();

    try {
      await sequelize.query(
        'CREATE TABLE ' +
          quotedShadow +
          ' ( LIKE ' +
          quotedMain +
          ' INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS )',
        { transaction },
      );

      const [colRows] = await sequelize.query(
        'SELECT column_name FROM information_schema.columns WHERE table_name = :shadowTable AND table_schema = current_schema() ORDER BY ordinal_position',
        { replacements: { shadowTable: shadowTableName }, raw: true, transaction },
      );
      const allColumns = (colRows as any[]).map((r: any) => r.column_name);
      await sequelize.query('ALTER TABLE ' + quotedShadow + ' ADD COLUMN __import_row_id__ BIGSERIAL PRIMARY KEY', {
        transaction,
      });
      // 影子表通过 CREATE TABLE ... LIKE 复制原表结构，但 createdAt/updatedAt 等字段在 NocoBase 中
      // 通常由 Sequelize 钩子维护，没有数据库默认值。未映射的这些字段若仍保留 NOT NULL，
      // 会导致 INSERT 时因显式 omitted 而报错，因此需要 DROP NOT NULL。
      const autoSystemFields = allColumns.filter((c) =>
        ['id', 'createdAt', 'updatedAt', 'createdById', 'updatedById'].includes(c),
      );
      await dropShadowNotNull(sequelize, shadowTableName, autoSystemFields, transaction);
      const dataColumns = resolveMappedDataColumns(allColumns, mapping, coll, pkColumns);
      if (dataColumns.length === 0) {
        throw new Error('没有可导入的字段');
      }

      await writeTaskLog(db, taskId, 'INFO', '影子表列: ' + dataColumns.join(', ') + '，主键: ' + pkColumns.join(', '));

      const BATCH_SIZE = Math.max(1, Math.min(2000, Math.floor(30000 / dataColumns.length)));
      const quotedCols = dataColumns.map((c) => quoteIdentifier(c)).join(', ');

      let batch: any[][] = [];
      let phase2Processed = 0;
      let phase2Cancelled = false;
      const phase2ErrorLogs: any[] = [];

      const flushBatch = async () => {
        if (batch.length === 0) return;
        try {
          await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, batch, transaction);
        } catch (batchErr: any) {
          await writeTaskLog(
            db,
            taskId,
            'WARN',
            '批次写入失败：' + (batchErr.message || String(batchErr)) + '，逐行定位...',
          );
          const splitLogs = await insertWithSplit(
            sequelize,
            quotedShadow,
            quotedCols,
            dataColumns,
            batch,
            phase2Processed - batch.length,
            transaction,
          );
          if (splitLogs.length > 0) {
            phase2ErrorLogs.push(...splitLogs);
            if (phase2ErrorLogs.length > 1000) phase2ErrorLogs.splice(1000);
            throw new Error(splitLogs.length + ' 行写入失败');
          }
        }
        batch = [];
      };

      await new Promise<void>((resolve, reject) => {
        streamProcessExcel(
          filePath,
          sheetName,
          hRow,
          async (rowNum, dataIdx, vals) => {
            if (cancelFlags.has(taskId)) {
              phase2Cancelled = true;
              return false;
            }
            if (dataIdx < 0) return true;
            if (isEmptyRow(vals, phase1Headers, mapping)) return true;

            const record = makeRecord(vals, phase1Headers, mapping, custVals);
            applyBelongsToFK(record, phase1Headers, vals, mapping, coll);

            const converted = convertRecordValues(record, coll);
            const rowVals = dataColumns.map((c) => (converted[c] !== undefined ? converted[c] : null));
            batch.push(rowVals);
            phase2Processed++;

            if (batch.length >= BATCH_SIZE) {
              try {
                await flushBatch();
              } catch (e) {
                reject(e);
                return false;
              }
              const prog = 50 + Math.floor((phase2Processed / Math.max(phase1TotalRows, 1)) * 40);
              try {
                await repo.update({
                  filterByTk: taskId,
                  values: { progress: Math.min(90, prog), processedRows: phase2Processed },
                });
              } catch {
                /* 忽略 */
              }
            }

            if (phase2Processed % 1000 === 0 && cancelFlags.has(taskId)) {
              phase2Cancelled = true;
              return false;
            }
            return true;
          },
          (headers) => {
            if (phase1Headers.length === 0) phase1Headers = headers;
          },
        )
          .then(async () => {
            try {
              await flushBatch();
              resolve();
            } catch (e) {
              reject(e);
            }
          })
          .catch(reject);
      });

      if (phase2Cancelled || cancelFlags.has(taskId)) {
        await sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow, { transaction });
        await transaction.commit();
        cancelFlags.delete(taskId);
        await writeTaskLog(db, taskId, 'WARN', '任务已取消（阶段二）');
        await repo.update({ filterByTk: taskId, values: { status: 'cancelled', completedAt: new Date() } });
        return;
      }

      if (phase2ErrorLogs.length > 0) {
        await sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow, { transaction });
        await transaction.commit();
        errorLogs = phase2ErrorLogs;
        for (let i = 0; i < Math.min(10, phase2ErrorLogs.length); i++) {
          const log = phase2ErrorLogs[i];
          await writeTaskLog(
            db,
            taskId,
            'ERROR',
            '第 ' + (log.row || i + 1) + ' 行写入失败：' + log.reason + '，快照：' + (log.snapshot || '{}'),
          );
        }
        await writeTaskLog(db, taskId, 'ERROR', '阶段二写入失败，共 ' + errorLogs.length + ' 个错误');
        await repo.update({
          filterByTk: taskId,
          values: {
            status: 'failed',
            errorLogs,
            errorMessage: '阶段二写入失败: ' + errorLogs.length + ' 行数据异常',
            completedAt: new Date(),
          },
        });
        return;
      }

      phase2TotalRows = phase2Processed;
      await writeTaskLog(db, taskId, 'SUCC', '阶段二影子表写入完成，共 ' + phase2TotalRows + ' 行');
      await repo.update({ filterByTk: taskId, values: { progress: 90, processedRows: phase2TotalRows } });

      await writeTaskLog(db, taskId, 'INFO', '阶段三：原子迁移开始...');
      try {
        await sequelize.query("SET LOCAL statement_timeout = '30min'", { transaction });
      } catch {
        /* 忽略 */
      }

      const targetRepo = db.getRepository(tableName);
      const PHASE3_BATCH_SIZE = 5000;

      const buildRecordFromShadow = (row: any): Record<string, any> => {
        const rec: Record<string, any> = {};
        for (const col of dataColumns) {
          rec[col] = row[col];
        }
        for (const pk of pkColumns) {
          if (!mapping[pk] || mapping[pk] === '__ignore__') {
            delete rec[pk];
          } else if (rec[pk] === null || rec[pk] === '' || rec[pk] === undefined) {
            delete rec[pk];
          }
        }
        const now = new Date().toISOString();
        // 注意：NocoBase 的 context 字段钩子会在 beforeCreate/beforeBulkCreate 中强制覆盖
        // createdById/updatedById，因此直接写入的值会被忽略。insert/upsert-insert 分支
        // 在调用 repo.create 时会注入 context 使钩子取到任务创建者，随后通过
        // fixCreatedSystemFields 再按映射关系修正一次（支持用户显式映射这些字段）。
        if (allColumns.includes('createdById') && !dataColumns.includes('createdById') && userId) {
          rec.createdById = userId;
        }
        if (allColumns.includes('updatedById') && !dataColumns.includes('updatedById') && userId) {
          rec.updatedById = userId;
        }
        if (allColumns.includes('createdAt') && !dataColumns.includes('createdAt')) {
          rec.createdAt = now;
        }
        if (allColumns.includes('updatedAt') && !dataColumns.includes('updatedAt')) {
          rec.updatedAt = now;
        }
        return rec;
      };

      // 在 repo.create 触发 NocoBase 自动生成 ID 后，再通过 SQL 按影子表数据修正
      // createdById/updatedById/createdAt/updatedAt，确保：1) 用户显式映射时优先写入；
      // 2) 未映射时使用任务创建者/当前时间；3) 绕过 context 字段钩子对显式赋值的覆盖。
      const fixCreatedSystemFields = async (instances: any[], sourceRows: any[], options: { transaction: any }) => {
        if (instances.length === 0 || sourceRows.length === 0) return;
        const sysFields: string[] = [];
        if (allColumns.includes('createdById')) sysFields.push('createdById');
        if (allColumns.includes('updatedById')) sysFields.push('updatedById');
        if (allColumns.includes('createdAt')) sysFields.push('createdAt');
        if (allColumns.includes('updatedAt')) sysFields.push('updatedAt');
        if (sysFields.length === 0) return;

        const pkAttr = pkColumns[0] || 'id';
        const valueRows: string[] = [];
        const replacements: Record<string, any> = {};
        for (let i = 0; i < instances.length; i++) {
          const inst = instances[i];
          const row = sourceRows[i];
          const id = inst.get(pkAttr);
          valueRows.push(`(:id${i}, :cb${i}, :ub${i}, :cat${i}, :uat${i})`);
          replacements[`id${i}`] = id;
          replacements[`cb${i}`] = dataColumns.includes('createdById') ? row.createdById : userId;
          replacements[`ub${i}`] = dataColumns.includes('updatedById') ? row.updatedById : userId;
          replacements[`cat${i}`] = dataColumns.includes('createdAt') ? row.createdAt : null;
          replacements[`uat${i}`] = dataColumns.includes('updatedAt') ? row.updatedAt : null;
        }

        const setClauses: string[] = [];
        if (allColumns.includes('createdById')) {
          setClauses.push(`${quoteIdentifier('createdById')} = v.${quoteIdentifier('createdById')}::bigint`);
        }
        if (allColumns.includes('updatedById')) {
          setClauses.push(`${quoteIdentifier('updatedById')} = v.${quoteIdentifier('updatedById')}::bigint`);
        }
        if (allColumns.includes('createdAt')) {
          setClauses.push(
            `${quoteIdentifier('createdAt')} = COALESCE(v.${quoteIdentifier(
              'createdAt',
            )}::timestamp with time zone, m.${quoteIdentifier('createdAt')})`,
          );
        }
        if (allColumns.includes('updatedAt')) {
          setClauses.push(
            `${quoteIdentifier('updatedAt')} = COALESCE(v.${quoteIdentifier(
              'updatedAt',
            )}::timestamp with time zone, m.${quoteIdentifier('updatedAt')})`,
          );
        }

        const sql = `
          UPDATE ${quoteIdentifier(tableName)} AS m
          SET ${setClauses.join(', ')}
          FROM (VALUES ${valueRows.join(', ')})
          AS v(${quoteIdentifier(pkAttr)}, ${sysFields.map((f) => quoteIdentifier(f)).join(', ')})
          WHERE m.${quoteIdentifier(pkAttr)} = v.${quoteIdentifier(pkAttr)}
        `;
        await sequelize.query(sql, { replacements, transaction: options.transaction });
      };

      const readShadowBatch = async (lastRowId: number): Promise<any[]> => {
        const [rows] = await sequelize.query(
          'SELECT ' +
            dataColumns.map((c) => quoteIdentifier(c)).join(', ') +
            ', __import_row_id__ ' +
            'FROM ' +
            quotedShadow +
            ' WHERE __import_row_id__ > :lastRowId ORDER BY __import_row_id__ LIMIT :limit',
          { replacements: { lastRowId, limit: PHASE3_BATCH_SIZE }, raw: true, transaction },
        );
        return rows as any[];
      };

      const checkPkConflicts = async (): Promise<void> => {
        const mappedPkColumns = pkColumns.filter((pk) => mapping[pk] && mapping[pk] !== '__ignore__');
        if (mappedPkColumns.length === 0) return;
        const pkNullChecks = mappedPkColumns.map((pk) => 's.' + quoteIdentifier(pk) + ' IS NOT NULL').join(' AND ');
        const pkMatchChecks = mappedPkColumns
          .map((pk) => 'm.' + quoteIdentifier(pk) + ' = s.' + quoteIdentifier(pk))
          .join(' AND ');
        const [conflicts] = await sequelize.query(
          'SELECT ' +
            mappedPkColumns.map((c) => 'm.' + quoteIdentifier(c)).join(', ') +
            ' FROM ' +
            quotedMain +
            ' m WHERE EXISTS (' +
            'SELECT 1 FROM ' +
            quotedShadow +
            ' s WHERE ' +
            pkMatchChecks +
            ' AND ' +
            pkNullChecks +
            ') LIMIT 1',
          { raw: true, transaction },
        );
        if ((conflicts as any[]).length > 0) {
          const sample = (conflicts as any[])[0];
          const sampleKey = mappedPkColumns.map((pk) => pk + '=' + sample[pk]).join(', ');
          throw new Error('主键值与数据库已有记录冲突（' + sampleKey + '）');
        }
      };

      let processedCount = 0;
      let updatedCount = 0;

      if (mode === 'update') {
        const setCols = dataColumns.filter((c) => !pkColumns.includes(c));
        const setClauses: string[] = [];
        for (const col of setCols) {
          if (bCellMode === 'skip') {
            setClauses.push(
              quoteIdentifier(col) + ' = COALESCE(s.' + quoteIdentifier(col) + ', m.' + quoteIdentifier(col) + ')',
            );
          } else {
            setClauses.push(quoteIdentifier(col) + ' = s.' + quoteIdentifier(col));
          }
        }
        for (const f of ['updatedAt', 'updatedById']) {
          if (allColumns.includes(f) && !dataColumns.includes(f)) {
            setClauses.push(
              quoteIdentifier(f) + ' = ' + (f === 'updatedAt' ? 'NOW()' : (userId || 'NULL') + '::bigint'),
            );
          }
        }
        const whereClauses = uFields
          .map((uf) => 'm.' + quoteIdentifier(uf) + ' = s.' + quoteIdentifier(uf))
          .join(' AND ');
        if (setClauses.length === 0 || !whereClauses) {
          throw new Error('更新模式缺少可更新字段或唯一值字段');
        }

        let lastRowId = 0;
        let batchRows = await readShadowBatch(lastRowId);
        while (batchRows.length > 0) {
          if (cancelFlags.has(taskId)) throw new Error('任务已取消');
          const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;

          const [result] = await sequelize.query(
            'UPDATE ' +
              quotedMain +
              ' m SET ' +
              setClauses.join(', ') +
              ' FROM ' +
              quotedShadow +
              ' s' +
              ' WHERE ' +
              whereClauses +
              ' AND s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId' +
              ' RETURNING m.id',
            { replacements: { lastRowId, maxRowId }, transaction },
          );
          updatedCount += (result as any[]).length;
          processedCount += batchRows.length;
          lastRowId = maxRowId;

          const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
          try {
            await repo.update({
              filterByTk: taskId,
              values: { progress: Math.min(98, prog), processedRows: processedCount },
            });
          } catch {
            /* 忽略 */
          }
          batchRows = await readShadowBatch(lastRowId);
        }
      } else {
        if (mode === 'insert') {
          await checkPkConflicts();
        }

        let lastRowId = 0;
        let batchRows = await readShadowBatch(lastRowId);
        while (batchRows.length > 0) {
          if (cancelFlags.has(taskId)) throw new Error('任务已取消');
          const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;

          if (mode === 'upsert') {
            const setCols = dataColumns.filter((c) => !uFields.includes(c) && !pkColumns.includes(c));
            const setClauses: string[] = [];
            for (const col of setCols) {
              if (bCellMode === 'skip') {
                setClauses.push(
                  quoteIdentifier(col) + ' = COALESCE(s.' + quoteIdentifier(col) + ', m.' + quoteIdentifier(col) + ')',
                );
              } else {
                setClauses.push(quoteIdentifier(col) + ' = s.' + quoteIdentifier(col));
              }
            }
            for (const f of ['updatedAt', 'updatedById']) {
              if (allColumns.includes(f) && !dataColumns.includes(f)) {
                setClauses.push(
                  quoteIdentifier(f) + ' = ' + (f === 'updatedAt' ? 'NOW()' : (userId || 'NULL') + '::bigint'),
                );
              }
            }
            const whereClauses = uFields
              .map((uf) => 'm.' + quoteIdentifier(uf) + ' = s.' + quoteIdentifier(uf))
              .join(' AND ');
            if (uFields.length > 0 && setClauses.length > 0) {
              const [updateResult] = await sequelize.query(
                'UPDATE ' +
                  quotedMain +
                  ' m SET ' +
                  setClauses.join(', ') +
                  ' FROM ' +
                  quotedShadow +
                  ' s' +
                  ' WHERE ' +
                  whereClauses +
                  ' AND s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId' +
                  ' RETURNING m.id',
                { replacements: { lastRowId, maxRowId }, transaction },
              );
              updatedCount += (updateResult as any[]).length;
            }

            const [newRows] = await sequelize.query(
              'SELECT s.* FROM ' +
                quotedShadow +
                ' s' +
                ' WHERE s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId' +
                (uFields.length > 0
                  ? ' AND NOT EXISTS (SELECT 1 FROM ' +
                    quotedMain +
                    ' m WHERE ' +
                    uFields.map((uf) => 'm.' + quoteIdentifier(uf) + ' = s.' + quoteIdentifier(uf)).join(' AND ') +
                    ')'
                  : ''),
              { replacements: { lastRowId, maxRowId }, raw: true, transaction },
            );
            const records = (newRows as any[]).map(buildRecordFromShadow);
            if (records.length > 0) {
              const instances = await targetRepo.create({
                values: records,
                transaction,
                context: { state: { currentUser: { id: userId } } },
              } as any);
              await fixCreatedSystemFields(instances, newRows, { transaction });
            }
            processedCount += batchRows.length;
          } else {
            const records = batchRows.map(buildRecordFromShadow);
            const instances = await targetRepo.create({
              values: records,
              transaction,
              context: { state: { currentUser: { id: userId } } },
            } as any);
            await fixCreatedSystemFields(instances, batchRows, { transaction });
            processedCount += batchRows.length;
          }

          lastRowId = maxRowId;
          const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
          try {
            await repo.update({
              filterByTk: taskId,
              values: { progress: Math.min(98, prog), processedRows: processedCount },
            });
          } catch {
            /* 忽略 */
          }
          batchRows = await readShadowBatch(lastRowId);
        }
      }

      await sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow, { transaction });
      await transaction.commit();

      const successMsg =
        mode === 'update'
          ? '迁移完成，更新 ' + updatedCount + ' 行，影子表已删除'
          : mode === 'upsert'
            ? '迁移完成，更新 ' + updatedCount + ' 行，新增 ' + (processedCount - updatedCount) + ' 行，影子表已删除'
            : '迁移完成，共 ' + processedCount + ' 行，影子表已删除';

      await writeTaskLog(db, taskId, 'SUCC', successMsg);
      await repo.update({
        filterByTk: taskId,
        values: { status: 'completed', progress: 100, processedRows: processedCount, completedAt: new Date() },
      });
    } catch (phaseErr: any) {
      try {
        await transaction.rollback();
      } catch {
        /* 忽略 */
      }
      try {
        await sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow);
      } catch {
        /* 忽略 */
      }
      throw phaseErr;
    }
  } catch (err: any) {
    try {
      const fallbackLogs =
        errorLogs.length > 0
          ? errorLogs
          : [
              {
                reason: err.message || String(err),
                snapshot: 'shadowTable=' + (shadowTableName || '?') + ', mode=' + mode + ', phase=阶段三',
              },
            ];
      await writeTaskLog(
        db,
        taskId,
        'ERROR',
        '导入失败(' + mode + '模式, 表' + tableName + '): ' + (err.message || String(err)),
      );
      await repo.update({
        filterByTk: taskId,
        values: {
          status: 'failed',
          errorMessage: err.message || String(err),
          errorLogs: fallbackLogs,
          completedAt: new Date(),
        },
      });
    } catch {
      /* 忽略 */
    }
  } finally {
    cancelFlags.delete(taskId);
  }
}

async function insertBatch(
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

async function insertWithSplit(
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

// __PROCESS_IMPORT_ASYNC_PLACEHOLDER__

async function fail(taskId: number, db: Database, message: string) {
  try {
    const repo = db.getRepository('sjgl02_tasks');
    await writeTaskLog(db, taskId, 'ERROR', message);
    await repo.update({
      filterByTk: taskId,
      values: { status: 'failed', errorMessage: message, completedAt: new Date() },
    });
  } catch {
    /* 忽略 */
  }
}
