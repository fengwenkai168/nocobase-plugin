import { Context, Next } from '@nocobase/actions';
import ExcelJS from 'exceljs';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { Mutex } from 'async-mutex';
import { checkExportPermission } from './permission-check';
import { writeTaskLog } from './taskLogs';
import { cancelFlags } from './cancel-state';
import { execSync } from 'child_process';
import type { Database } from '@nocobase/database';

const exportMutex = new Mutex();

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:!@#\$%\^&\(\)]/g, '_').substring(0, 31);
}

function formatFileName(template: string, tableName: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return template.replace(/\{表名\}/g, tableName).replace(/\{日期\}/g, date);
}

function getFieldDisplayName(coll: any, fieldName: string, style?: string): string {
  try {
    const f = (coll.fields instanceof Map ? coll.fields.get(fieldName) : null);
    const title = f?.options?.uiSchema?.title;
    if (title && !/^\{\{/.test(title)) {
      if (style === 'id') return fieldName;
      if (style === 'title') return title;
      return `${title}(${fieldName})`;
    }
  } catch {}
  return fieldName;
}

function getCollDisplayName(coll: any, style?: string): string {
  const rawName = coll?.name || '';
  let title = coll?.options?.title || rawName;
  if (/^\{\{/.test(title)) title = rawName;
  if (style === 'id') return rawName;
  if (style === 'title') return title;
  return title !== rawName ? `${title}(${rawName})` : rawName;
}

function ensureUniqueSheetName(workbook: any, name: string): string {
  const existing = new Set((workbook.worksheets || []).map((s: any) => s.name));
  if (!existing.has(name)) return name;
  let i = 1;
  while (existing.has(`${name}_${i}`)) i++;
  return `${name}_${i}`;
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getScalarFields(coll: any): string[] {
  if (!coll) return [];
  const names: string[] = [];
  try {
    for (const f of Array.from(coll.fields?.values() || coll.fields || [])) {
      const type = (f as any).type;
      if (!['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(type)) {
        names.push((f as any).name);
      }
    }
  } catch {}
  return names;
}

function getAssociationFields(coll: any): Array<{ name: string; type: string; target: string }> {
  if (!coll) return [];
  const fields: Array<{ name: string; type: string; target: string }> = [];
  try {
    for (const f of Array.from(coll.fields?.values() || coll.fields || [])) {
      const type = (f as any).type;
      if (['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(type)) {
        fields.push({
          name: (f as any).name,
          type,
          target: (f as any).options?.target || (f as any).target || '',
        });
      }
    }
  } catch {}
  return fields;
}

/** 检测主键类型：返回 'int_auto' | 'uuid' | 'other' */
function detectPkType(coll: any): 'int_auto' | 'uuid' | 'other' {
  try {
    const fields = Array.from(coll.fields?.values() || coll.fields || []);
    const pk = fields.find((f: any) => (f as any).options?.primaryKey) as any;
    if (!pk) return 'other';
    const pkType = String(pk.type || '');
    if (pkType.includes('UUID') || pkType.includes('uuid')) return 'uuid';
    const autoIncr = pk.options?.autoIncrement;
    if (autoIncr !== false && (pkType.includes('INT') || pkType.includes('int') || pkType === 'bigInt' || pkType === 'BIGINT')) {
      return 'int_auto';
    }
    if (pkType.includes('INT') || pkType.includes('int') || pkType === 'bigInt' || pkType === 'BIGINT') return 'int_auto';
    return 'other';
  } catch {
    return 'other';
  }
}

export async function getExportTableFields(ctx: Context, next: Next) {
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
      uiSchema: { ...(f.options?.uiSchema || {}), title },
      interface: f.options?.interface || null,
      isRequired: autoFields.includes(f.name) ? false : f.options?.allowNull === false,
      isAssociation: ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type),
      isForeignKey: fkSet.has(f.name),
    };
  });
  ctx.body = fields;
  await next();
}

export async function previewCount(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { tableName, filter } = params;
  if (!tableName || tableName === '__all__') {
    let total = 0;
    const collections = ctx.db.collections;
    for (const [name, coll] of collections) {
      try {
        const repo = ctx.db.getRepository(name);
        if (repo) total += await repo.count({ filter: filter || {} });
      } catch {}
    }
    ctx.body = { estimatedRows: total };
    await next();
    return;
  }
  const repo = ctx.db.getRepository(tableName);
  const count = repo ? await repo.count({ filter: filter || {} }) : 0;
  ctx.body = { estimatedRows: count };
  await next();
}

export async function executeExport(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const {
    tableName, selectedFields, associationDisplayMode, includeAssociationSheet,
    associationSheetTables, filter, fileNameTemplate, includeAttachments, headerStyle,
  } = params;

  const exportFilter = (() => {
    if (!filter) return {};
    if (Array.isArray(filter)) {
      const obj: Record<string, any> = {};
      for (const cond of filter) {
        if (cond.field && cond.op && cond.value !== undefined) {
          const opMap: Record<string, string> = { eq: '$eq', contains: '$includes', gt: '$gt', lt: '$lt' };
          obj[cond.field] = { [opMap[cond.op] || '$eq']: cond.value };
        }
      }
      return obj;
    }
    return filter;
  })();

  if (!tableName) {
    ctx.throw(400, 'tableName is required');
  }

  if (tableName !== '__all__') {
    const exportPerm = await checkExportPermission(ctx, tableName);
    if (exportPerm.exportFields && exportPerm.exportFields.length > 0 && selectedFields && selectedFields.length > 0) {
      const invalidFields = selectedFields.filter((f: string) => !exportPerm.exportFields.includes(f));
      if (invalidFields.length > 0) {
        ctx.throw(403, `您的权限不允许导出以下字段：${invalidFields.join('、')}，请联系管理员`);
      }
    }
  }

  let allowedTableList: string[] | null = null;
  if (tableName === '__all__') {
    const names: string[] = [];
    const collections = ctx.db.collections;
    for (const [name] of collections) {
      try {
        const permCheck = await checkExportPermission(ctx, name);
        if (permCheck.canExport) names.push(name);
      } catch { }
    }
    allowedTableList = names;
  }

  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.create({
    values: {
      taskType: 'export',
      tableName,
      status: 'pending',
      selectedFields: selectedFields || [],
      exportFilter: exportFilter || {},
      associationDisplayMode: associationDisplayMode || {},
      includeAssociationSheet: includeAssociationSheet || false,
      associationSheetTables: associationSheetTables || [],
      includeAttachments: includeAttachments || false,
      totalRows: 0,
      progress: 0,
      fileName: tableName === '__all__' ? `全部数据表_${new Date().toISOString().slice(0, 10)}.zip` : '',
      createdById: ctx.state.currentUser?.id,
      headerStyle: headerStyle || 'title_id',
    },
  });

  const db = ctx.db;
  const taskId = task.id;

  ctx.body = { taskId };
  await next();

  setImmediate(() => {
    processExportAsync(db, taskId, {
      tableName, selectedFields, associationDisplayMode, includeAssociationSheet,
      associationSheetTables, exportFilter, fileNameTemplate, includeAttachments, headerStyle,
      allowedTableList,
    });
  });
}

interface ExportAsyncParams {
  tableName: string;
  selectedFields?: string[];
  associationDisplayMode?: Record<string, string>;
  includeAssociationSheet?: boolean;
  associationSheetTables?: string[];
  exportFilter?: Record<string, any>;
  fileNameTemplate?: string;
  includeAttachments?: boolean;
  headerStyle?: string;
  allowedTableList: string[] | null;
}

async function processExportAsync(db: Database, taskId: number, params: ExportAsyncParams) {
  const {
    tableName, selectedFields, associationDisplayMode, includeAssociationSheet,
    associationSheetTables, exportFilter, fileNameTemplate, includeAttachments, headerStyle,
    allowedTableList,
  } = params;

  const repo = db.getRepository('sjgl02_tasks');
  const release = await exportMutex.acquire();

  try {
    await repo.update({ filterByTk: taskId, values: { status: 'processing' } });

    await writeTaskLog(db, taskId, 'INFO', '开始执行导出任务');
    await writeTaskLog(db, taskId, 'INFO', `目标数据表: ${tableName}${tableName === '__all__' ? '（全部数据表）' : ''}`);

    const isAllTables = tableName === '__all__';
    const tableList: string[] = isAllTables
      ? (allowedTableList || [])
      : [tableName];

    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads';
    const tempDir = path.join(storageDir, 'exports');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    let totalRows = 0;
    let processedRows = 0;
    const outputFiles: string[] = [];
    let cancelled = false;

    // 全部数据表模式：延迟附件打包到最终合并
    const allAttachFileEntries: Array<{ entryName: string; diskPath: string }> = [];

    for (const tblName of tableList) {
      if (cancelFlags.has(taskId)) { cancelled = true; break; }

      const coll: any = db.getCollection(tblName);
      if (!coll) continue;
      const targetRepo = db.getRepository(tblName);
      if (!targetRepo) continue;

      let collectionTotal = 0;
      const appendFields: string[] = [];
      const attachmentFieldNames: string[] = [];
      const fileIdFieldNames: string[] = [];
      try {
        for (const f of Array.from(coll.fields?.values() || coll.fields || [])) {
          if ((f as any).type === 'belongsTo') appendFields.push((f as any).name);
          if ((f as any).type === 'belongsToMany') {
            const interfaceName = (f as any).options?.interface;
            if (includeAttachments && interfaceName === 'attachment' && !appendFields.includes((f as any).name)) {
              appendFields.push((f as any).name);
              attachmentFieldNames.push((f as any).name);
            } else if (!includeAttachments || interfaceName !== 'attachment') {
              if (!selectedFields?.length || selectedFields.includes((f as any).name)) {
                if (!appendFields.includes((f as any).name)) appendFields.push((f as any).name);
              }
            }
          }
          if ((f as any).type === 'hasMany' || (f as any).type === 'hasOne') {
            if (!selectedFields?.length || selectedFields.includes((f as any).name)) {
              if (!appendFields.includes((f as any).name)) appendFields.push((f as any).name);
            }
          }
          if (includeAttachments && ((f as any).type === 'integer') && /FileId$/.test((f as any).name)) {
            fileIdFieldNames.push((f as any).name);
          }
        }
      } catch {}
      try { const [, c] = await targetRepo.findAndCount({ filter: exportFilter || {}, limit: 1 }); collectionTotal = c; } catch {}
      if (collectionTotal === 0) continue;

      const fieldNames: string[] = (selectedFields && selectedFields.length > 0)
        ? selectedFields
        : getScalarFields(coll);
      if (!fieldNames || fieldNames.length === 0) continue;

      const collDisplay = sanitizeSheetName(getCollDisplayName(coll, headerStyle)).replace(/\s+/g, '_');
      const xlsxName = `sjgl02_export_${taskId}_${Date.now()}.xlsx`;
      const filePath = path.join(tempDir, xlsxName);

      const streamWriter = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: filePath, useStyles: true, useSharedStrings: true,
      });
      streamWriter.creator = 'NocoBase @my-project/plugin-sjgl02';
      const mainSheet = streamWriter.addWorksheet(
        ensureUniqueSheetName(streamWriter as any, sanitizeSheetName(getCollDisplayName(coll, headerStyle)))
      );
      mainSheet.columns = fieldNames.map((name: string) => ({
        header: getFieldDisplayName(coll, name, headerStyle), key: name,
        width: Math.max(getFieldDisplayName(coll, name, headerStyle).length + 4, 20),
      }));
      (mainSheet.getRow(1) as any).font = { bold: true };
      (mainSheet.getRow(1) as any).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      // 附件 ID 收集（主循环合并，一次扫描）
      const attachIds = new Set<number>();
      const attachFieldMap = new Map<number, string>();

      const PAGE_SIZE = 5000;
      const pkType = detectPkType(coll);

      if (pkType === 'int_auto') {
        // 游标分页：WHERE id > ? ORDER BY id LIMIT ?
        let lastId = 0;
        while (true) {
          if (cancelFlags.has(taskId)) { cancelled = true; break; }
          const pageRecords = await targetRepo.find({
            filter: { ...(exportFilter || {}), id: { $gt: lastId } },
            sort: ['id'],
            limit: PAGE_SIZE,
            ...(appendFields.length > 0 ? { appends: appendFields } : {}),
          });
          if (pageRecords.length === 0) break;
          for (const record of pageRecords) {
            const row: Record<string, any> = {};
            for (const f of fieldNames) {
              let val = record[f];
              if (attachmentFieldNames.includes(f)) {
                if (Array.isArray(val) && val.length > 0) {
                  for (const a of val) { if (a?.id && !attachIds.has(a.id)) { attachIds.add(a.id); attachFieldMap.set(a.id, f); } }
                  val = val.map((a: any) => a.filename || a.title || a.id || '').join(', ');
                } else val = '';
              } else if (fileIdFieldNames.includes(f)) {
                if (val !== null && val !== undefined && !attachIds.has(Number(val))) {
                  attachIds.add(Number(val)); attachFieldMap.set(Number(val), f);
                }
                val = val !== null && val !== undefined ? String(val) : '';
               } else if (Array.isArray(val)) {
                  val = val.map((item: any) => {
                    const name = item.nickname || item.name || item.title || item.id || '';
                    return name ? `${name}(主键：${item.id})` : '';
                  }).filter(Boolean).join(', ');
                } else if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date)) {
                val = val.nickname || val.username || val.name || val.email || val.id || JSON.stringify(val);
              }
              row[f] = formatValue(val);
            }
            mainSheet.addRow(row).commit();
            processedRows++;
            totalRows++;
          }
          lastId = Number((pageRecords[pageRecords.length - 1] as any).id);
          const progress = Math.min(100, Math.floor((processedRows / Math.max(1, collectionTotal)) * 100));
          try { await repo.update({ filterByTk: taskId, values: { processedRows, totalRows, progress } }); } catch {}
        }
      } else if (pkType === 'uuid') {
        // UUID：预取 ID 数组 → IN 分批
        try { await db.sequelize.query("SET SESSION statement_timeout = '30min'"); } catch {}
        const allIds: any[] = [];
        let uuidOffset = 0;
        while (true) {
          const idPage = await targetRepo.find({
            filter: exportFilter || {},
            fields: ['id'],
            offset: uuidOffset,
            limit: PAGE_SIZE,
          });
          if (idPage.length === 0) break;
          allIds.push(...idPage.map((r: any) => r.id));
          uuidOffset += PAGE_SIZE;
        }
        for (let bi = 0; bi < allIds.length; bi += PAGE_SIZE) {
          if (cancelFlags.has(taskId)) { cancelled = true; break; }
          const batch = allIds.slice(bi, bi + PAGE_SIZE);
          const pageRecords = await targetRepo.find({
            filter: { ...(exportFilter || {}), id: { $in: batch } },
            limit: PAGE_SIZE,
            ...(appendFields.length > 0 ? { appends: appendFields } : {}),
          });
          for (const record of pageRecords) {
            const row: Record<string, any> = {};
            for (const f of fieldNames) {
              let val = record[f];
              if (attachmentFieldNames.includes(f)) {
                if (Array.isArray(val) && val.length > 0) {
                  for (const a of val) { if (a?.id && !attachIds.has(a.id)) { attachIds.add(a.id); attachFieldMap.set(a.id, f); } }
                  val = val.map((a: any) => a.filename || a.title || a.id || '').join(', ');
                } else val = '';
              } else if (fileIdFieldNames.includes(f)) {
                if (val !== null && val !== undefined && !attachIds.has(Number(val))) {
                  attachIds.add(Number(val)); attachFieldMap.set(Number(val), f);
                }
                val = val !== null && val !== undefined ? String(val) : '';
               } else if (Array.isArray(val)) {
                  val = val.map((item: any) => {
                    const name = item.nickname || item.name || item.title || item.id || '';
                    return name ? `${name}(主键：${item.id})` : '';
                  }).filter(Boolean).join(', ');
                } else if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date)) {
                val = val.nickname || val.username || val.name || val.email || val.id || JSON.stringify(val);
              }
              row[f] = formatValue(val);
            }
            mainSheet.addRow(row).commit();
            processedRows++;
            totalRows++;
          }
          const progress = Math.min(100, Math.floor((processedRows / Math.max(1, collectionTotal)) * 100));
          try { await repo.update({ filterByTk: taskId, values: { processedRows, totalRows, progress } }); } catch {}
        }
      } else {
        // 其他主键类型：传统 offset/limit 分页
        let offset = 0;
        while (offset < collectionTotal) {
          if (cancelFlags.has(taskId)) { cancelled = true; break; }
          const pageRecords = await targetRepo.find({
            filter: exportFilter || {}, offset, limit: PAGE_SIZE,
            ...(appendFields.length > 0 ? { appends: appendFields } : {}),
          });
          if (pageRecords.length === 0) break;
          for (const record of pageRecords) {
            const row: Record<string, any> = {};
            for (const f of fieldNames) {
              let val = record[f];
              if (attachmentFieldNames.includes(f)) {
                if (Array.isArray(val) && val.length > 0) {
                  for (const a of val) { if (a?.id && !attachIds.has(a.id)) { attachIds.add(a.id); attachFieldMap.set(a.id, f); } }
                  val = val.map((a: any) => a.filename || a.title || a.id || '').join(', ');
                } else val = '';
              } else if (fileIdFieldNames.includes(f)) {
                if (val !== null && val !== undefined && !attachIds.has(Number(val))) {
                  attachIds.add(Number(val)); attachFieldMap.set(Number(val), f);
                }
                val = val !== null && val !== undefined ? String(val) : '';
               } else if (Array.isArray(val)) {
                  val = val.map((item: any) => {
                    const name = item.nickname || item.name || item.title || item.id || '';
                    return name ? `${name}(主键：${item.id})` : '';
                  }).filter(Boolean).join(', ');
                } else if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date)) {
                val = val.nickname || val.username || val.name || val.email || val.id || JSON.stringify(val);
              }
              row[f] = formatValue(val);
            }
            mainSheet.addRow(row).commit();
            processedRows++;
            totalRows++;
          }
          offset += PAGE_SIZE;
          const progress = Math.min(100, Math.floor((offset * 100) / Math.max(1, collectionTotal)));
          try { await repo.update({ filterByTk: taskId, values: { processedRows, totalRows, progress } }); } catch {}
        }
      }

      if (cancelled) break;

      // 关联数据 Sheet（保留原有功能）
      if (includeAssociationSheet) {
        const assocFields = getAssociationFields(coll);
        for (const af of assocFields.filter((af: any) => !fieldNames.length || fieldNames.includes(af.name))) {
          const assocRepo = db.getRepository(af.target);
          if (!assocRepo) continue;
          let assocTotal = 0;
          try { const [, cnt] = await assocRepo.findAndCount({ limit: 1 }); assocTotal = cnt; } catch {}
          if (assocTotal === 0) continue;
          const assocColl = db.getCollection(af.target);
          const assocScalarFields = getScalarFields(assocColl);
          if (!assocScalarFields || assocScalarFields.length === 0) continue;

          const fieldDisplay = getFieldDisplayName(coll, af.name, headerStyle);
          const sheetDisplay = getCollDisplayName(assocColl, headerStyle);
          const sheetName = ensureUniqueSheetName(streamWriter as any, sanitizeSheetName(fieldDisplay + '-' + sheetDisplay).substring(0, 31));
          const assocSheet = streamWriter.addWorksheet(sheetName);
          assocSheet.columns = assocScalarFields.map((n: string) => ({
            header: getFieldDisplayName(assocColl, n, headerStyle), key: n,
            width: Math.max(getFieldDisplayName(assocColl, n, headerStyle).length + 4, 20),
          }));
          (assocSheet.getRow(1) as any).font = { bold: true };
          (assocSheet.getRow(1) as any).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };

          let aOff = 0;
          while (aOff < assocTotal) {
            if (cancelFlags.has(taskId)) { cancelled = true; break; }
            const aRecs = await assocRepo.find({ offset: aOff, limit: PAGE_SIZE });
            for (const rec of aRecs) {
              const row: Record<string, any> = {};
              for (const f of assocScalarFields) {
                let val = rec[f];
                if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date))
                  val = (val.nickname || val.title || val.name || val.id || JSON.stringify(val));
                row[f] = formatValue(val);
              }
              assocSheet.addRow(row).commit();
              totalRows++; processedRows++;
            }
            aOff += PAGE_SIZE;
            const ap = Math.min(100, Math.floor((aOff * 100) / Math.max(1, assocTotal)));
            try { await repo.update({ filterByTk: taskId, values: { processedRows, totalRows, progress: Math.max(ap, 0) } }); } catch {}
          }
          if (cancelled) break;
          assocSheet.commit();
        }
      }

      mainSheet.commit();
      await streamWriter.commit();

      if (cancelled) break;

      // 附件打包：已收集的 attachIds
      let finalFilePath = filePath;
      if (includeAttachments && attachIds.size > 0) {
        const fileIdFilenameMap = new Map<number, string>();
        try {
          const ar = await db.getRepository('attachments').find({ filter: { id: Array.from(attachIds) } });
          ar.forEach((at: any) => { if (at.filename) fileIdFilenameMap.set(at.id, at.filename); });
        } catch {}
        if (fileIdFilenameMap.size > 0) {
          try {
            const attachmentFiles: Array<{ entryName: string; diskPath: string }> = [];
            for (const [aid, fn] of fileIdFilenameMap) {
              let realPath = path.join(storageDir, fn);
              if (!fs.existsSync(realPath)) {
                const atRecords = await db.getRepository('attachments').find({ filter: { id: [aid] } });
                if (atRecords[0]?.path !== undefined) {
                  realPath = path.join(storageDir, atRecords[0].path || '', fn);
                }
              }
              if (!fs.existsSync(realPath)) continue;
              const afName = attachFieldMap.get(aid) || '附件';
              const folderName = sanitizeSheetName(getFieldDisplayName(coll, afName, headerStyle));
              attachmentFiles.push({ entryName: `${folderName}/${fn}`, diskPath: realPath });
            }
            if (attachmentFiles.length > 0) {
              if (isAllTables) {
                // 全部数据表：延迟打包，仅收集附件信息到全局列表
                allAttachFileEntries.push(...attachmentFiles);
              } else {
                // 单表：直接创建 per-table ZIP
                const zipName = `sjgl02_export_${taskId}_${Date.now()}.zip`;
                const zipPath = path.join(tempDir, zipName);
                try {
                  const zipOutput = fs.createWriteStream(zipPath);
                  const zipArchive = archiver('zip', { zlib: { level: 1 } });
                  await new Promise<void>((resolve, reject) => {
                    zipArchive.on('error', reject);
                    zipOutput.on('close', resolve);
                    zipOutput.on('error', reject);
                    zipArchive.pipe(zipOutput);
                    zipArchive.file(filePath, { name: path.basename(filePath) });
                    for (const af of attachmentFiles) {
                      zipArchive.file(af.diskPath, { name: af.entryName });
                    }
                    zipArchive.finalize();
                  });
                  try { fs.unlinkSync(filePath); } catch {}
                  outputFiles.push(zipPath);
                  finalFilePath = zipPath;
                } catch (attErr: any) {
                  await writeTaskLog(db, taskId, 'WARN', `附件打包失败(${tblName}): ${attErr.message || String(attErr)}，跳过打包`);
                }
              }
            }
          } catch {}
        }
      }

      if (!outputFiles.includes(finalFilePath)) {
        outputFiles.push(finalFilePath);
      }

      await repo.update({
        filterByTk: taskId,
        values: { progress: Math.min(100, Math.floor((processedRows / Math.max(totalRows, 1)) * 100)), processedRows, totalRows },
      });
    }

    if (cancelled) {
      // 取消：删除已生成的临时文件
      for (const fp of outputFiles) { try { fs.unlinkSync(fp); } catch {} }
      await writeTaskLog(db, taskId, 'WARN', '任务已取消');
      await repo.update({ filterByTk: taskId, values: { status: 'cancelled', completedAt: new Date() } });
      return;
    }

    if (outputFiles.length === 0) {
      throw new Error('没有数据可导出');
    }

    let mergedFilePath: string;
    if (outputFiles.length === 1 && allAttachFileEntries.length === 0) {
      mergedFilePath = outputFiles[0];
    } else {
      await writeTaskLog(db, taskId, 'INFO', `最终合并 ${outputFiles.length} 个文件${allAttachFileEntries.length > 0 ? ' + ' + allAttachFileEntries.length + ' 个附件' : ''}...`);
      try { await db.sequelize.query("SET SESSION statement_timeout = 0"); } catch {}

      const zipName = `sjgl02_export_${taskId}_${Date.now()}.zip`;
      mergedFilePath = path.join(tempDir, zipName);

      // 创建临时目录，symlink 所有文件到一起，用系统 zip 打包
      const stagingDir = path.join(tempDir, `staging_${taskId}`);
      try { fs.rmSync(stagingDir, { recursive: true }); } catch {}
      fs.mkdirSync(stagingDir, { recursive: true });

      // 链入导出文件
      for (const fp of outputFiles) {
        try { fs.symlinkSync(fp, path.join(stagingDir, path.basename(fp))); } catch {}
      }
      // 链入附件文件（保留目录结构）
      for (const af of allAttachFileEntries) {
        try {
          const dest = path.join(stagingDir, af.entryName);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.symlinkSync(af.diskPath, dest);
        } catch {}
      }

      // 系统 zip 打包（C 原生，快且省内存）
      try {
        execSync(`cd "${stagingDir}" && zip -0 -q -r "${mergedFilePath}" .`, { stdio: 'pipe', timeout: 600000 });
        await writeTaskLog(db, taskId, 'SUCC', '最终合并完成');
      } catch (zipErr: any) {
        await writeTaskLog(db, taskId, 'ERROR', `zip 合并失败: ${(zipErr.stderr || zipErr.message || '').toString().slice(0, 200)}`);
        throw zipErr;
      }
      // 清理临时目录
      try { fs.rmSync(stagingDir, { recursive: true }); } catch {}
      for (const fp of outputFiles) {
        try { fs.unlinkSync(fp); } catch {}
      }
    }

    // 将临时文件重命名为可读格式（表名称(表标识)_日期，无前缀）
    const d = new Date();
    const padDate = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}${padDate(d.getMonth() + 1)}${padDate(d.getDate())}${padDate(d.getHours())}${padDate(d.getMinutes())}${padDate(d.getSeconds())}`;
    const isZip = mergedFilePath.endsWith('.zip');
    let finalDisplayName: string;
    if (tableName === '__all__') {
      finalDisplayName = isZip ? `全部数据表_${dateStr}.zip` : `全部数据表_${dateStr}.xlsx`;
    } else {
      const exportColl = db.getCollection(tableName);
      const collDisplayName = exportColl
        ? sanitizeSheetName(getCollDisplayName(exportColl, headerStyle)).replace(/\s+/g, '_')
        : tableName;
      finalDisplayName = `${collDisplayName}_${dateStr}${isZip ? '.zip' : '.xlsx'}`;
    }
    let finalFilePath = path.join(tempDir, finalDisplayName);
    let suffix = 0;
    while (fs.existsSync(finalFilePath)) {
      suffix++;
      finalFilePath = path.join(tempDir, finalDisplayName.replace(/\.(xlsx|zip)$/, `_${suffix}.${isZip ? 'zip' : 'xlsx'}`));
    }
    fs.renameSync(mergedFilePath, finalFilePath);
    mergedFilePath = finalFilePath;

    const stats = await fsp.stat(mergedFilePath);
    const attachRepo = db.getRepository('attachments');
    const exportAttachment = await attachRepo.create({
      values: {
        title: path.basename(mergedFilePath),
        filename: path.basename(mergedFilePath),
        extname: path.extname(mergedFilePath),
        mimetype: mergedFilePath.endsWith('.zip')
          ? 'application/zip'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: stats.size,
        path: path.relative(storageDir, mergedFilePath).replace(/\\/g, '/'),
      },
    });

    await repo.update({
      filterByTk: taskId,
      values: {
        status: 'completed',
        progress: 100,
        processedRows,
        totalRows,
        exportFileId: exportAttachment.id,
        fileName: exportAttachment.filename || exportAttachment.title || '',
        completedAt: new Date(),
      },
    });
    await writeTaskLog(db, taskId, 'SUCC', `导出完成，共 ${processedRows} 行数据`);
    // 注意：完成文件保留，不删除（用户可下载）
  } catch (err: any) {
    try {
      await writeTaskLog(db, taskId, 'ERROR', `导出失败: ${err.message || String(err)}`);
      await writeTaskLog(db, taskId, 'WARN', '文件未生成，数据未修改');
      await repo.update({
        filterByTk: taskId,
        values: {
          status: 'failed',
          errorMessage: err.message || String(err),
          completedAt: new Date(),
        },
      });
    } catch {}
  } finally {
    cancelFlags.delete(taskId);
    release();
  }
}

export async function getProgress(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  ctx.body = {
    progress: task.progress,
    status: task.status,
    exportFileId: task.exportFileId,
  };
  await next();
}

export async function downloadExport(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  if (!task.exportFileId) {
    ctx.throw(404, 'Export file not found');
  }
  const attachRepo = ctx.db.getRepository('attachments');
  const attachment = await attachRepo.findOne({ filter: { id: task.exportFileId } });
  if (!attachment) {
    ctx.throw(404, 'Attachment record not found');
  }
  const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads';
  const filePath = path.join(storageDir, attachment.path || attachment.filename);
  if (!fs.existsSync(filePath)) {
    ctx.throw(404, 'File not found on disk');
  }
  const fileName = attachment.title || attachment.filename || 'export.xlsx';
  ctx.attachment(encodeURIComponent(fileName));
  ctx.set('Content-Type', attachment.mimetype || 'application/octet-stream');
  ctx.body = fs.createReadStream(filePath);
  await next();
}
