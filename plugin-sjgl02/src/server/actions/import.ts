import { Context, Next } from '@nocobase/actions';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { checkImportPermission } from './permission-check';

export async function getTableFields(ctx: Context, next: Next) {
  const { tableName } = ctx.action.params;
  if (!tableName || tableName === '__all__') {
    ctx.body = [];
    await next();
    return;
  }
  const coll: any = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, `Table ${tableName} not found`);
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
  const fields = rawFields.map((f: any) => {
    let title = f.options?.uiSchema?.title || null;
    if (title && /^\{\{/.test(title)) title = null;
    return {
      name: f.name,
      type: f.type,
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
      ctx.throw(400, `Unsupported format: ${ext}. Only .xlsx, .xls, .csv allowed`);
    }
    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads';
    const filePath = path.join(storageDir, attachment.path || attachment.filename);
    if (!fs.existsSync(filePath)) {
      ctx.throw(404, 'File not found on disk');
    }
    const workbook = XLSX.readFile(filePath, { type: 'file' });
    const sheets = workbook.SheetNames;
    const targetSheet = sheetName || sheets[0];
    const ws = workbook.Sheets[targetSheet];
    if (!ws) {
      ctx.throw(400, `Sheet "${targetSheet}" not found`);
    }
    const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const hRow = Math.max(0, (parseInt(String(headerRow), 10) || 1) - 1);
    const headerColumns = (allRows[hRow] || []).map((h: any) => String(h));
    const dataRows = allRows.slice(hRow + 1).filter((r: any[]) => r.some((c: any) => c !== ''));
    const previewRows = dataRows.slice(0, 10).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headerColumns.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
      return obj;
    });
    ctx.body = {
      sheets,
      headerColumns,
      fileId,
      fileName: attachment.filename || attachment.title,
      previewRows,
      totalRows: dataRows.length,
    };
  } catch (err: any) {
    if (err.status) throw err;
    ctx.throw(500, 'Failed to parse file: ' + err.message);
  }
  await next();
}

export async function preview(ctx: Context, next: Next) {
  const p = ctx.action.params;
  const fileId = p.fileId || ctx.request.query?.fileId || ctx.query?.fileId;
  const sheetName = p.sheetName || ctx.request.query?.sheetName;
  const headerRow = p.headerRow || ctx.request.query?.headerRow;
  if (!fileId) {
    ctx.throw(400, 'fileId is required');
  }
  try {
    const attachRepo = ctx.db.getRepository('attachments');
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      ctx.throw(404, 'Uploaded file not found in storage');
    }
    const filePath = path.join(
      process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads',
      attachment.path || attachment.filename,
    );
    if (!fs.existsSync(filePath)) {
      ctx.throw(404, 'File not found on disk: ' + filePath);
    }
    const workbook = XLSX.readFile(filePath, { type: 'file' });
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheetName];
    if (!sheet) {
      ctx.throw(400, `Sheet "${targetSheetName}" not found`);
    }
    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const hRow = Math.max(0, (parseInt(String(headerRow), 10) || 1) - 1);
    const headers = (allRows[hRow] || []).map((h: any) => String(h));
    const dataRows = allRows.slice(hRow + 1).filter((r: any[]) => r.some((c: any) => c !== ''));
    const previewRows = dataRows.slice(0, 10).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
      return obj;
    });
    ctx.body = {
      preview: previewRows,
      totalRows: dataRows.length,
      columns: headers,
    };
  } catch (err: any) {
    if (err.status) throw err;
    ctx.throw(500, 'Failed to preview file: ' + err.message);
  }
  await next();
}

export async function executeImport(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { tableName, fileId, sheetName, headerRow, fieldMapping, customValues, importMode, uniqueFields } = params;
  if (!tableName || !fileId) {
    ctx.throw(400, 'tableName and fileId are required');
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, `Table ${tableName} not found`);
  }

  const perm = await checkImportPermission(ctx, tableName);

  if (perm.importMode.length > 0 && !perm.importMode.includes(importMode)) {
    ctx.throw(403, `您的权限不允许使用「${importMode}」模式导入数据表「${tableName}」，允许的模式：${perm.importMode.join('、')}`);
  }

  const allowedImportFields = perm.importFields || [];
  if (allowedImportFields.length > 0 && fieldMapping) {
    for (const tableField of Object.keys(fieldMapping)) {
      if (!allowedImportFields.includes(tableField)) {
        ctx.throw(403, `您的权限不允许导入字段「${tableField}」，请联系管理员`);
      }
    }
  }

  const requiredPermFields = perm.requiredFields || [];
  if (requiredPermFields.length > 0 && fieldMapping) {
    for (const rf of requiredPermFields) {
      const mappedTo = fieldMapping[rf];
      if (!mappedTo || mappedTo === '__ignore__') {
        ctx.throw(400, `必填字段「${rf}」未在字段映射中配置`);
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
      importMode: importMode || 'insert',
      sheetName: sheetName || 'Sheet1',
      headerRow: headerRow || 1,
      importFileId: fileId,
      uniqueFields: uniqueFields || [],
      totalRows: 0,
      progress: 0,
      createdById: ctx.state.currentUser?.id,
    },
  });

  const sequelize = ctx.db.sequelize;
  const transaction = await sequelize.transaction();
  await repo.update({ filterByTk: task.id, values: { status: 'processing' }, transaction });

  try {
    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads';
    const filePath = path.join(storageDir, attachment.path || attachment.filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found on disk: ' + filePath);
    }
    const workbook = XLSX.readFile(filePath, { type: 'file' });
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheetName];
    if (!sheet) {
      throw new Error(`Sheet "${targetSheetName}" not found`);
    }
    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const hRow = Math.max(0, (parseInt(String(headerRow), 10) || 1) - 1);
    const headers = (allRows[hRow] || []).map((h: any) => String(h));
    const dataRows = allRows.slice(hRow + 1).filter((r: any[]) => r.some((c: any) => c !== ''));

    const mapping = fieldMapping || {};
    const custVals = customValues || {};

    const totalRows = dataRows.length;
    await repo.update({ filterByTk: task.id, values: { totalRows }, transaction });

    const targetRepo = ctx.db.getRepository(tableName);
    const errorLogs: any[] = [];
    let processedRows = 0;

    const normalizeDateValue = (val: string): string => {
      if (!val || !val.trim()) return val;
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) return val;
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
      return val;
    };

    const dateFieldNames: string[] = [];
    try {
      for (const f of Array.from(coll.fields?.values() || [])) {
        if (['date', 'datetime', 'datetimeTz', 'unixTimestamp'].includes((f as any).type)) {
          dateFieldNames.push((f as any).name);
        }
      }
    } catch {}

    const makeRecord = (row: any[]): Record<string, any> => {
      const record: Record<string, any> = {};
      for (const [tableField, excelCol] of Object.entries(mapping)) {
        if (!excelCol || excelCol === '__ignore__') continue;
        if (excelCol === '__custom__') {
          record[tableField] = String(custVals[tableField] ?? '');
          continue;
        }
        const colIndex = headers.indexOf(excelCol as string);
        if (colIndex >= 0 && colIndex < row.length) {
          record[tableField] = String(row[colIndex] !== undefined && row[colIndex] !== null ? row[colIndex] : '');
        } else {
          record[tableField] = String(excelCol);
        }
      }
      return record;
    };

    const buildSnapshot = (row: any[]) => {
      const snap: Record<string, string> = {};
      Object.entries(mapping).forEach(([fieldName, excelCol]) => {
        if (excelCol && excelCol !== '__ignore__') {
          if (excelCol === '__custom__') {
            snap[fieldName + '=(自定义)'] = custVals[fieldName] || '';
          } else {
            const idx = headers.indexOf(excelCol as string);
            if (idx >= 0 && idx < row.length) snap[excelCol + '→' + fieldName] = String(row[idx] ?? '');
          }
        }
      });
      return JSON.stringify(snap).substring(0, 500);
    };

    const applyBelongsToFK = (record: Record<string, any>) => {
      const belonegs: any[] = [];
      try { belonegs.push(...Array.from(coll.fields?.values() || []).filter((f: any) => f.type === 'belongsTo' && f.name !== 'createdBy' && f.name !== 'updatedBy')); } catch {}
      for (const bf of belonegs) {
        const fk = bf.options?.foreignKey || (bf.name + 'Id');
        const mappedVal = mapping[bf.name];
        if (mappedVal && mappedVal !== '__ignore__') {
          const colIdx = headers.indexOf(mappedVal as string);
          if (colIdx >= 0 && colIdx < (dataRows[i] as any[]).length) {
            record[fk] = (dataRows[i] as any[])[colIdx];
          }
          delete record[bf.name];
        }
      }
    };

    const processedUniques = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = i + 1;
      try {
        const record = makeRecord(dataRows[i]);
        for (const fn of dateFieldNames) {
          const v = record[fn];
          if (typeof v === 'string') record[fn] = normalizeDateValue(v);
        }
        if ((importMode === 'update' || importMode === 'upsert') && uniqueFields.length > 0) {
          const allFilled = uniqueFields.every(uf => record[uf] !== undefined && record[uf] !== '');
          if (allFilled) {
            const ufKey = uniqueFields.map(uf => String(record[uf] || '')).join('||');
            if (processedUniques.has(ufKey)) {
              errorLogs.push({
                row: rowIndex,
                excelRow: (headerRow || 1) + rowIndex - 1,
                reason: `唯一值字段组合重复 / Duplicate unique fields: ${uniqueFields.join('+')} = ${ufKey}`,
                snapshot: buildSnapshot(dataRows[i]),
              });
              continue;
            }
            processedUniques.add(ufKey);
          }
        }
        if (importMode === 'update' || importMode === 'upsert') {
          const uFields = uniqueFields || [];
          if (uFields.length === 0) {
            if (importMode === 'update') {
              errorLogs.push({
                row: rowIndex,
                excelRow: (headerRow || 1) + rowIndex - 1,
                reason: '更新模式未配置唯一值字段，无法匹配已有记录',
                snapshot: buildSnapshot(dataRows[i]),
              });
              continue;
            }
          } else {
            const filter: Record<string, any> = {};
          for (const uf of uFields) {
            if (record[uf] !== undefined) filter[uf] = record[uf];
          }
          if (Object.keys(filter).length > 0) {
            const [existingRecords, matchCount] = await targetRepo.findAndCount({ filter, limit: 2, transaction });
            if (matchCount > 1) {
              errorLogs.push({
                row: rowIndex,
                excelRow: (headerRow || 1) + rowIndex - 1,
                reason: `唯一值匹配到 ${matchCount} 条记录，无法确定更新目标 (Ambiguous: ${matchCount} records matched unique fields)`,
                snapshot: buildSnapshot(dataRows[i]),
              });
              continue;
            }
            if (matchCount === 1) {
              applyBelongsToFK(record);
              await targetRepo.update({ filterByTk: existingRecords[0].id, values: record, transaction, context: ctx });
              processedRows++;
              continue;
            }
          } else {
            if (importMode === 'update') {
              errorLogs.push({
                row: rowIndex,
                excelRow: (headerRow || 1) + rowIndex - 1,
                reason: '唯一值字段在数据行中未找到值，无法匹配',
                snapshot: buildSnapshot(dataRows[i]),
              });
              continue;
            }
          }
          }
        }
        if (importMode === 'insert' || importMode === 'upsert') {
          applyBelongsToFK(record);
          await targetRepo.create({ values: record, transaction, context: ctx });
          processedRows++;
        } else if (importMode === 'update') {
          errorLogs.push({
            row: rowIndex,
            excelRow: (headerRow || 1) + rowIndex - 1,
            reason: '未匹配到已有记录（更新模式）',
            snapshot: buildSnapshot(dataRows[i]),
          });
        }
      } catch (rowErr: any) {
        errorLogs.push({
          row: rowIndex,
          excelRow: (headerRow || 1) + rowIndex - 1,
          reason: rowErr.message || String(rowErr),
          snapshot: buildSnapshot