import { Context, Next } from '@nocobase/actions';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { checkImportPermission } from './permission-check';
import { writeTaskLog } from './taskLogs';
import { cancelFlags } from './cancel-state';
import type { Database } from '@nocobase/database';

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

/** WorkbookReader 流式读取 Excel 文件 */
function streamProcessExcel(
  filePath: string,
  targetSheet: string | undefined,
  headerRow: number,
  onRow: (excelRowNum: number, dataIndex: number, rowValues: any[]) => boolean | void,
): Promise<{ headers: string[]; totalRows: number }> {
  return new Promise((resolve, reject) => {
    const WorkbookReaderCtor = (ExcelJS.stream.xlsx as any).WorkbookReader;
    const workbookReader: any = new WorkbookReaderCtor(filePath, {});
    let sheetFound = false;
    let ready = false;
    let headers: string[] = [];
    const hRowNum = headerRow || 1;
    let dataIndex = 0;
    let totalRows = 0;
    let destroyed = false;

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      try { workbookReader.destroy(); } catch {}
    };

    workbookReader.on('worksheet', (worksheet: any) => {
      if (destroyed || sheetFound) return;
      if (targetSheet && worksheet.name !== targetSheet) return;
      sheetFound = true;

      worksheet.on('row', (row: any) => {
        if (destroyed) return;
        const rowNum = row.number;
        if (rowNum < hRowNum) return;
        if (rowNum === hRowNum) {
          headers = (row.values || []).slice(1).map((h: any) => String(h ?? ''));
          ready = true;
          return;
        }
        if (!ready) return;
        const vals = (row.values || []).slice(1);
        const isEmpty = !vals.some((v: any) => v !== undefined && v !== null && v !== '');
        if (isEmpty) { dataIndex++; return; }
        totalRows++;
        const shouldContinue = onRow(rowNum, dataIndex, vals);
        dataIndex++;
        if (shouldContinue === false) destroy();
      });

      worksheet.on('end', () => { ready = true; });
    });

    workbookReader.on('end', () => resolve({ headers, totalRows }));
    workbookReader.on('error', (err: any) => {
      if (destroyed) resolve({ headers, totalRows });
      else reject(err);
    });
    workbookReader.read();
  });
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

    const previewRows: Record<string, any>[] = [];
    let headerColumns: string[] = [];
    let totalRows = 0;

    await streamProcessExcel(filePath, sheetName, parseInt(String(headerRow), 10) || 1, (rowNum, dataIdx, vals) => {
      if (dataIdx < 0) return true;
      if (dataIdx < 10) {
        const obj: Record<string, any> = {};
        headerColumns.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
        previewRows.push(obj);
      }
      return dataIdx < 10;
    }).then((result) => {
      headerColumns = result.headers;
      totalRows = result.totalRows;
    });

    ctx.body = {
      sheets: [sheetName || 'Sheet1'],
      headerColumns,
      fileId,
      fileName: attachment.filename || attachment.title,
      previewRows,
      totalRows,
    };
  } catch (err: any) {
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
    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads';
    const filePath = path.join(storageDir, attachment.path || attachment.filename);
    if (!fs.existsSync(filePath)) {
      ctx.throw(404, 'File not found on disk: ' + filePath);
    }

    const previewRows: any[] = [];
    let columns: string[] = [];
    let totalRows = 0;

    const hRow = parseInt(String(headerRow), 10) || 1;
    await streamProcessExcel(filePath, sheetName, hRow, (rowNum, dataIdx, vals) => {
      if (dataIdx < 0) return true;
      if (dataIdx < previewLimit) {
        const obj: Record<string, any> = {};
        columns.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
        previewRows.push(obj);
      }
      return dataIdx < previewLimit;
    }).then((result) => {
      columns = result.headers;
      totalRows = result.totalRows;
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
  const { tableName, fileId, sheetName, headerRow, fieldMapping, customValues, importMode, uniqueFields, blankCellMode, permSource } = params;
  if (!tableName || !fileId) {
    ctx.throw(400, 'tableName and fileId are required');
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, `Table ${tableName} not found`);
  }

  const perm = await checkImportPermission(ctx, tableName, permSource);

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
      tableName, fileId, sheetName, headerRow, fieldMapping, customValues,
      importMode, uniqueFields, blankCellMode,
      attachmentPath: attachment.path || attachment.filename,
    });
  });
}

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
  attachmentPath: string;
}

async function processImportAsync(db: Database, taskId: number, params: ImportAsyncParams) {
  const { tableName, sheetName, headerRow, fieldMapping, customValues, importMode, uniqueFields, blankCellMode, attachmentPath } = params;
  const repo = db.getRepository('sjgl02_tasks');
  const sequelize = db.sequelize;
  const mapping = fieldMapping || {};
  const custVals = customValues || {};
  const uFields = uniqueFields || [];
  const hRow = parseInt(String(headerRow), 10) || 1;
  const bCellMode = blankCellMode || 'update';

  const coll: any = db.getCollection(tableName);
  const dateFieldNames: string[] = [];
  try {
    for (const f of Array.from(coll.fields?.values() || [])) {
      if (['date', 'datetime', 'datetimeTz', 'unixTimestamp'].includes((f as any).type)) {
        dateFieldNames.push((f as any).name);
      }
    }
  } catch {}

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

  function applyBelongsToFK(record: Record<string, any>, vals: any[], headers: string[]) {
    const belongs: any[] = [];
    try {
      belongs.push(...Array.from(coll.fields?.values() || []).filter(
        (f: any) => f.type === 'belongsTo' && f.name !== 'createdBy' && f.name !== 'updatedBy'
      ));
    } catch {}
    for (const bf of belongs) {
      const fk = bf.options?.foreignKey || (bf.name + 'Id');
      const mappedVal = mapping[bf.name];
      if (mappedVal && mappedVal !== '__ignore__') {
        const colIdx = headers.indexOf(mappedVal as string);
        if (colIdx >= 0 && colIdx < vals.length) {
          record[fk] = vals[colIdx];
        }
        delete record[bf.name];
      }
    }
  }

  function makeRecord(vals: any[], headers: string[]): Record<string, any> {
    const record: Record<string, any> = {};
    for (const [tableField, excelCol] of Object.entries(mapping)) {
      if (!excelCol || excelCol === '__ignore__') continue;
      if (excelCol === '__custom__') {
        record[tableField] = String(custVals[tableField] ?? '');
        continue;
      }
      const colIndex = headers.indexOf(excelCol as string);
      if (colIndex >= 0 && colIndex < vals.length) {
        let raw = vals[colIndex];
        if (raw === undefined || raw === null || raw === '') {
          if (bCellMode === 'skip') continue;
          if (bCellMode === 'null') { record[tableField] = null; continue; }
        }
        record[tableField] = String(raw !== undefined && raw !== null ? raw : '');
      } else {
        record[tableField] = String(excelCol);
      }
    }
    return record;
  }

  function buildSnapshot(vals: any[], headers: string[]): string {
    const snap: Record<string, string> = {};
    Object.entries(mapping).forEach(([fieldName, excelCol]) => {
      if (excelCol && excelCol !== '__ignore__') {
        if (excelCol === '__custom__') {
          snap[fieldName + '=(自定义)'] = custVals[fieldName] || '';
        } else {
          const idx = headers.indexOf(excelCol as string);
          if (idx >= 0 && idx < vals.length) snap[excelCol + '→' + fieldName] = String(vals[idx] ?? '');
        }
      }
    });
    return JSON.stringify(snap).substring(0, 500);
  }

  function isEmptyRow(vals: any[], headers: string[]): boolean {
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

  const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads';
  const filePath = path.join(storageDir, attachmentPath);
  if (!fs.existsSync(filePath)) {
    await writeTaskLog(db, taskId, 'ERROR', '文件未找到: ' + filePath);
    await repo.update({ filterByTk: taskId, values: { status: 'failed', errorMessage: '文件未找到: ' + filePath, completedAt: new Date() } });
    return;
  }

  try {
    await repo.update({ filterByTk: taskId, values: { status: 'processing' } });
    await writeTaskLog(db, taskId, 'INFO', '开始执行导入任务');
    await writeTaskLog(db, taskId, 'INFO', `目标数据表: ${tableName}`);
    await writeTaskLog(db, taskId, 'INFO', `导入模式: ${importMode || 'insert'}`);

    // ==================== 阶段一：流式预校验 ====================
    await writeTaskLog(db, taskId, 'INFO', '阶段一：流式预校验开始...');
    const errorLogs: any[] = [];
    let phase1TotalRows = 0;
    let phase1Processed = 0;
    let phase1Headers: string[] = [];
    const seenUniqueValues = new Set<string>();
    let phase1Cancelled = false;

    const phase1Result = await new Promise<{ passed: boolean }>((resolve) => {
      streamProcessExcel(filePath, sheetName, hRow, (rowNum, dataIdx, vals) => {
        if (cancelFlags.has(taskId)) { phase1Cancelled = true; return false; }
        if (dataIdx < 0) return true;
        if (isEmptyRow(vals, phase1Headers)) return true;

        phase1TotalRows++;
        phase1Processed++;

        const record = makeRecord(vals, phase1Headers);

        if ((importMode === 'update' || importMode === 'upsert') && uFields.length > 0) {
          const emptyUFields = uFields.filter(uf => record[uf] === undefined || record[uf] === '' || record[uf] === null);
          if (emptyUFields.length > 0) {
            if (errorLogs.length < 1000) {
              errorLogs.push({
                row: dataIdx + 1,
                excelRow: rowNum,
                reason: `唯一值字段为空（${emptyUFields.join(', ')}）`,
                snapshot: buildSnapshot(vals, phase1Headers),
              });
            }
          } else {
            const ufKey = uFields.map(uf => record[uf]).join('||');
            if (seenUniqueValues.has(ufKey)) {
              if (errorLogs.length < 1000) {
                errorLogs.push({
                  row: dataIdx + 1,
                  excelRow: rowNum,
                  reason: `Excel 内部唯一值重复: ${uFields.join('+')} = ${ufKey}`,
                  snapshot: buildSnapshot(vals, phase1Headers),
                });
              }
            } else {
              seenUniqueValues.add(ufKey);
            }
          }
        }

        if (phase1Processed % 10000 === 0) {
          try {
            repo.update({
              filterByTk: taskId,
              values: { progress: Math.min(50, Math.floor((phase1Processed / Math.max(phase1Processed, 1)) * 50)) },
            });
          } catch {}
        }

        return true;
      }).then((result) => {
        phase1Headers = result.headers;
        if (phase1TotalRows === 0) phase1TotalRows = result.totalRows;
        resolve({ passed: !phase1Cancelled && errorLogs.length === 0 });
      });
    });

    if (phase1Cancelled) {
      await writeTaskLog(db, taskId, 'WARN', '任务已取消（阶段一）');
      cancelFlags.delete(taskId);
      await repo.update({ filterByTk: taskId, values: { status: 'cancelled', completedAt: new Date() } });
      return;
    }

    await repo.update({ filterByTk: taskId, values: { totalRows: phase1TotalRows } });
    await writeTaskLog(db, taskId, 'SUCC', `阶段一预校验完成，共 ${phase1TotalRows} 行有效数据`);

    if (!phase1Result.passed) {
      await writeTaskLog(db, taskId, 'ERROR', `阶段一预校验失败，共 ${errorLogs.length} 个错误`);
      await repo.update({
        filterByTk: taskId,
        values: { status: 'failed', errorLogs, errorMessage: `预校验失败: ${errorLogs.length} 个错误`, completedAt: new Date() },
      });
      return;
    }

    // ==================== 阶段二：影子表写入 ====================
    await writeTaskLog(db, taskId, 'INFO', '阶段二：影子表写入开始...');
    const shadowTableName = `_sjgl02_import_${taskId}`;
    const quotedMain = `"${tableName}"`;
    const quotedShadow = `"${shadowTableName}"`;

    try {
      await sequelize.query(`
        CREATE TABLE ${quotedShadow} (
          LIKE ${quotedMain}
          INCLUDING DEFAULTS
          INCLUDING CONSTRAINTS
          INCLUDING STORAGE
          INCLUDING COMMENTS
        )
      `);
      await sequelize.query(`ALTER TABLE ${quotedShadow} ALTER COLUMN id DROP DEFAULT`);

      const [colRows] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${shadowTableName}' AND table_schema = current_schema()
         ORDER BY ordinal_position`,
        { raw: true },
      );
      const allColumns = (colRows as any[]).map((r: any) => r.column_name);
      const nonIdColumns = allColumns.filter(c => c !== 'id');
      const quotedCols = allColumns.map(c => `"${c}"`).join(', ');

      // 流式读取收集所有行数据
      const allRowValues: any[][] = [];
      let phase2Headers: string[] = [];
      let phase2Cancelled = false;

      await streamProcessExcel(filePath, sheetName, hRow, (rowNum, dataIdx, vals) => {
        if (cancelFlags.has(taskId)) { phase2Cancelled = true; return false; }
        if (dataIdx < 0) return true;
        if (isEmptyRow(vals, phase2Headers)) return true;

        const record = makeRecord(vals, phase2Headers);
        for (const fn of dateFieldNames) {
          const v = record[fn];
          if (typeof v === 'string') record[fn] = normalizeDateValue(v);
        }

        if ((importMode === 'update' || importMode === 'upsert') && uFields.length > 0) {
          const allFilled = uFields.every(uf => record[uf] !== undefined && record[uf] !== '');
          if (!allFilled) return true;
        }

        const rowVals = allColumns.map(c => record[c] !== undefined ? record[c] : null);
        allRowValues.push(rowVals);

        if (allRowValues.length % 1000 === 0 && cancelFlags.has(taskId)) {
          phase2Cancelled = true;
          return false;
        }

        return true;
      }).then((result) => { phase2Headers = result.headers; });

      if (phase2Cancelled || cancelFlags.has(taskId)) {
        await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`);
        await writeTaskLog(db, taskId, 'WARN', '任务已取消（阶段二）');
        cancelFlags.delete(taskId);
        await repo.update({ filterByTk: taskId, values: { status: 'cancelled', completedAt: new Date() } });
        return;
      }

      const phase2TotalRows = allRowValues.length;

      // 批量 INSERT 到影子表（每 5000 行一批）
      const BATCH_SIZE = 5000;
      for (let bi = 0; bi < allRowValues.length; bi += BATCH_SIZE) {
        if (cancelFlags.has(taskId)) {
          await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`);
          await writeTaskLog(db, taskId, 'WARN', '任务已取消（阶段二写入）');
          cancelFlags.delete(taskId);
          await repo.update({ filterByTk: taskId, values: { status: 'cancelled', completedAt: new Date() } });
          return;
        }
        const batch = allRowValues.slice(bi, bi + BATCH_SIZE);
        const placeholders = batch.map(
          (_, ri) => `(${allColumns.map((__, ci) => `$${ri * allColumns.length + ci + 1}`).join(', ')})`
        ).join(', ');
        const flatValues = batch.flat();
        await sequelize.query(
          `INSERT INTO ${quotedShadow} (${quotedCols}) VALUES ${placeholders}`,
          { bind: flatValues },
        );
        const prog = 50 + Math.floor((bi * 40) / Math.max(allRowValues.length, 1));
        try {
          await repo.update({ filterByTk: taskId, values: { progress: Math.min(90, prog) } });
        } catch {}
      }

      await writeTaskLog(db, taskId, 'SUCC', `阶段二影子表写入完成，共 ${phase2TotalRows} 行`);
      await repo.update({ filterByTk: taskId, values: { progress: 90 } });

      // ==================== 阶段三：原子迁移 ====================
      await writeTaskLog(db, taskId, 'INFO', '阶段三：原子迁移开始...');

      try {
        await sequelize.query("SET SESSION statement_timeout = '30min'");
      } catch {}

      const transaction = await sequelize.transaction();
      let updatedCount = 0;

      try {
        if (importMode === 'update') {
          const setClauses: string[] = [];
          for (const col of nonIdColumns) {
            if (bCellMode === 'skip' && Object.values(mapping).some(v => v === col)) {
              const stillMap = Object.entries(mapping).some(([tf, ec]) => {
                if (ec === '__ignore__' || ec === '__custom__') return false;
                if (ec === col) return true;
                const idx = phase2Headers.indexOf(ec);
                return idx >= 0 && phase2Headers[idx] === col;
              });
              if (stillMap) continue;
            }
            setClauses.push(`"${col}" = s."${col}"`);
          }
          const whereClauses = uFields.map(uf => `m."${uf}" = s."${uf}"`).join(' AND ');

          if (setClauses.length > 0 && whereClauses) {
            const [updateResult] = await sequelize.query(
              `UPDATE ${quotedMain} m SET ${setClauses.join(', ')} FROM ${quotedShadow} s WHERE ${whereClauses} RETURNING m.id`,
              { transaction },
            );
            updatedCount = (updateResult as any[]).length;
            await writeTaskLog(db, taskId, 'INFO', `更新模式：匹配 ${updatedCount} 行，影子表共 ${phase2TotalRows} 行`);
          }
        } else if (importMode === 'upsert') {
          const conflictCols = uFields.map(uf => `"${uf}"`).join(', ');
          const updateSetClauses = nonIdColumns
            .filter(c => !uFields.includes(c))
            .map(c => `"${c}" = EXCLUDED."${c}"`)
            .join(', ');

          await sequelize.query(
            `INSERT INTO ${quotedMain} SELECT * FROM ${quotedShadow} ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSetClauses}`,
            { transaction },
          );
        } else {
          const hasId = mapping.id && mapping.id !== '__ignore__';
          if (hasId) {
            await sequelize.query(
              `INSERT INTO ${quotedMain} SELECT * FROM ${quotedShadow}`,
              { transaction },
            );
          } else {
            const nonIdQuotedCols = nonIdColumns.map(c => `"${c}"`).join(', ');
            await sequelize.query(
              `INSERT INTO ${quotedMain} (${nonIdQuotedCols}) SELECT ${nonIdQuotedCols} FROM ${quotedShadow}`,
              { transaction },
            );
          }
        }

        await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`, { transaction });
        await transaction.commit();

        if ((importMode === 'insert') && mapping.id && mapping.id !== '__ignore__') {
          try {
            const [seqRows] = await sequelize.query(
              `SELECT pg_get_serial_sequence('${tableName}', 'id') AS seq_name`,
              { raw: true },
            );
            const seqName = (seqRows as any[])[0]?.seq_name;
            if (seqName) {
              const [maxRows] = await sequelize.query(
                `SELECT COALESCE(MAX(id), 0) AS max_id FROM ${quotedMain}`,
                { raw: true },
              );
              const maxId = parseInt((maxRows as any[])[0]?.max_id || '0', 10);
              await sequelize.query(`SELECT setval('${seqName}', ${maxId + 1})`);
            }
          } catch {}
        }

        const successMsg = importMode === 'update'
          ? `迁移完成，更新 ${updatedCount} 行，影子表已删除`
          : `迁移完成，共 ${phase2TotalRows} 行，影子表已删除`;

        await writeTaskLog(db, taskId, 'SUCC', successMsg);
        await repo.update({
          filterByTk: taskId,
          values: { status: 'completed', progress: 100, processedRows: phase2TotalRows, completedAt: new Date() },
        });
      } catch (migrateErr: any) {
        await transaction.rollback();
        try { await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`); } catch {}
        throw migrateErr;
      }
    } catch (phase2Err: any) {
      try { await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`); } catch {}
      throw phase2Err;
    }
  } catch (err: any) {
    try {
      await writeTaskLog(db, taskId, 'ERROR', `导入异常: ${err.message || String(err)}`);
      await repo.update({
        filterByTk: taskId,
        values: { status: 'failed', errorMessage: err.message || String(err), completedAt: new Date() },
      });
    } catch {}
  } finally {
    cancelFlags.delete(taskId);
  }
}
