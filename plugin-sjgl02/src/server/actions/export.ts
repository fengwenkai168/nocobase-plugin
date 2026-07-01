import { Context, Next } from '@nocobase/actions';
import ExcelJS from 'exceljs';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { Mutex } from 'async-mutex';
import { checkExportPermission } from './permission-check';

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

function getFieldDisplayName(coll: any, fieldName: string): string {
  try {
    const f = (coll.fields instanceof Map ? coll.fields.get(fieldName) : null);
    const title = f?.options?.uiSchema?.title;
    if (title && !/^\{\{/.test(title)) return `${title}(${fieldName})`;
  } catch {}
  return fieldName;
}

function getCollDisplayName(coll: any): string {
  const rawName = coll?.name || '';
  let title = coll?.options?.title || rawName;
  if (/^\{\{/.test(title)) title = rawName;
  return title !== rawName ? `${title}(${rawName})` : rawName;
}

function ensureUniqueSheetName(workbook: ExcelJS.Workbook, name: string): string {
  const existing = new Set(workbook.worksheets.map((s: any) => s.name));
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
    associationSheetTables, filter, fileNameTemplate, includeAttachments,
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

  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.create({
    values: {
      taskType: 'export',
      tableName,
      status: 'processing',
      selectedFields: selectedFields || [],
      exportFilter: exportFilter || {},
      associationDisplayMode: associationDisplayMode || {},
      includeAssociationSheet: includeAssociationSheet || false,
      associationSheetTables: associationSheetTables || [],
      includeAttachments: includeAttachments || false,
      totalRows: 0,
      progress: 0,
      createdById: ctx.state.currentUser?.id,
    },
  });

  const release = await exportMutex.acquire();

  try {
    const isAllTables = tableName === '__all__';
    const tableList: string[] = isAllTables
      ? (() => {
          const names: string[] = [];
          const collections = ctx.db.collections;
          for (const [name] of collections) {
            names.push(name);
          }
          return names;
        })()
      : [tableName];

    const tempDir = path.join(process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads', 'exports');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    let totalRows = 0;
    let processedRows = 0;
    const outputFiles: string[] = [];

    for (const tblName of tableList) {
      const coll = ctx.db.getCollection(tblName);
      if (!coll) continue;
      const targetRepo = ctx.db.getRepository(tblName);
      if (!targetRepo) continue;

      if (tableName === '__all__') {
        try {
          const permCheck = await checkExportPermission(ctx, tblName);
          if (!permCheck.canExport) continue;
        } catch {
          continue;
        }
      }

      let records: any[] = [];
      let collectionTotal = 0;
      const appendFields: string[] = [];
      const attachmentFieldNames: string[] = [];
      const fileIdFieldNames: string[] = [];
      try {
        for (const f of Array.from(coll.fields?.values() || coll.fields || [])) {
          if ((f as any).type === 'belongsTo') appendFields.push((f as any).name);
          if (includeAttachments && ((f as any).type === 'belongsToMany')) {
            const interfaceName = (f as any).options?.interface;
            if (interfaceName === 'attachment' && !appendFields.includes((f as any).name)) {
              appendFields.push((f as any).name);
              attachmentFieldNames.push((f as any).name);
            }
          }
          if (includeAttachments && ((f as any).type === 'integer') && /FileId$/.test((f as any).name)) {
            fileIdFieldNames.push((f as any).name);
          }
        }
      } catch {}
      const queryOpts: any = { filter: exportFilter || {}, limit: 20000 };
      if (appendFields.length > 0) queryOpts.appends = appendFields;
      try {
        const [found, count] = await targetRepo.findAndCount(queryOpts);
        records = found;
        collectionTotal = count;
      } catch {
        try {
          records = await targetRepo.find({ filter: exportFilter || {}, limit: 20000 });
          collectionTotal = records.length;
        } catch { continue; }
      }

      const fieldNames: string[] = (selectedFields && selectedFields.length > 0)
        ? selectedFields
        : getScalarFields(coll);

      if (fieldNames.length === 0 && records[0]) {
        fieldNames.push(...Object.keys(records[0]).filter(k => !k.startsWith('_')));
      }

      if (records.length === 0 && fieldNames.length === 0) continue;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'NocoBase @my-project/plugin-sjgl02';
      const mainSheet = workbook.addWorksheet(ensureUniqueSheetName(workbook, sanitizeSheetName(getCollDisplayName(coll))));
      mainSheet.columns = fieldNames.map((name: string) => ({
        header: getFieldDisplayName(coll, name), key: name,
        width: Math.max(getFieldDisplayName(coll, name).length + 4, 20),
      }));
      const headerRow = mainSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      const fileIdFilenameMap = new Map<number, string>();
      const attachedIds = new Set<number>();
      const attachFieldMap = new Map<number, string>();
      if (includeAttachments && (attachmentFieldNames.length > 0 || fileIdFieldNames.length > 0)) {
        for (const record of records) {
          for (const afName of attachmentFieldNames) {
            const av = record[afName];
            if (Array.isArray(av)) {
              for (const a of av) {
                if (a?.id && !attachedIds.has(a.id)) {
                  attachedIds.add(a.id);
                  attachFieldMap.set(a.id, afName);
                }
              }
            }
          }
          for (const ffName of fileIdFieldNames) {
            const fid = record[ffName];
            if (fid && !attachedIds.has(fid)) {
              attachedIds.add(fid);
              attachFieldMap.set(fid, ffName);
            }
          }
        }
        if (attachedIds.size > 0) {
          try {
            const attachRepo = ctx.db.getRepository('attachments');
            const attachRecords = await attachRepo.find({ filter: { id: Array.from(attachedIds) } });
            for (const at of attachRecords) {
              if (at.filename) fileIdFilenameMap.set(at.id, at.filename);
            }
          } catch {}
        }
      }

      for (const record of records) {
        const row: Record<string, any> = {};
        for (const f of fieldNames) {
          let val = record[f];
          if (attachmentFieldNames.includes(f)) {
            if (Array.isArray(val) && val.length > 0) {
              val = val.map((a: any) => a.filename || a.title || a.id || '').join(', ');
            } else {
              val = '';
            }
          } else if (fileIdFieldNames.includes(f)) {
            val = fileIdFilenameMap.get(val) || String(val || '');
          } else if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date)) {
            const targetTitleField = coll.options?.titleField || 'id';
            val = val[targetTitleField] || val.id || JSON.stringify(val);
          }
          row[f] = formatValue(val);
        }
        mainSheet.addRow(row);
        totalRows++;
        processedRows++;
      }

      if (includeAssociationSheet) {
        const assocFields = getAssociationFields(coll);
        const exportAssocFields = assocFields.filter(af =>
          !fieldNames || fieldNames.length === 0 || fieldNames.includes(af.name)
        );
        for (const af of exportAssocFields) {
          const assocRepo = ctx.db.getRepository(af.target);
          if (!assocRepo) continue;
          let assocRecords: any[] = [];
          try {
            assocRecords = await assocRepo.find({ limit: 5000 });
          } catch { continue; }
          if (assocRecords.length === 0) continue;

          const assocScalarFields = getScalarFields(ctx.db.getCollection(af.target));
          if (assocScalarFields.length === 0 && assocRecords[0]) {
            assocScalarFields.push(...Object.keys(assocRecords[0]).filter(k => !k.startsWith('_')));
          }

          const assocColl = ctx.db.getCollection(af.target);
          const fieldDisplay = getFieldDisplayName(coll, af.name);
          const collDisplay = getCollDisplayName(assocColl);
          const sheetName = ensureUniqueSheetName(workbook, sanitizeSheetName(fieldDisplay + '-' + collDisplay).substring(0, 31));
          const assocSheet = workbook.addWorksheet(sheetName);
          assocSheet.columns = assocScalarFields.map((n: string) => ({
            header: getFieldDisplayName(assocColl, n), key: n,
            width: Math.max(getFieldDisplayName(assocColl, n).length + 4, 20),
          }));
          const ahRow = assocSheet.getRow(1);
          ahRow.font = { bold: true };
          ahRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };

          for (const rec of assocRecords) {
            const row: Record<string, any> = {};
            for (const f of assocScalarFields) {
              let val = rec[f];
              if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date)) {
            val = (val.nickname || val.title || val.name || (val.id !== undefined && val.id !== null ? val.id : JSON.stringify(val)));
              }
              row[f] = formatValue(val);
            }
            assocSheet.addRow(row);
            totalRows++;
            processedRows++;
          }
        }
      }

      const collDisplay = sanitizeSheetName(getCollDisplayName(coll)).replace(/\s+/g, '_');
      const xlsxName = collDisplay + '-' + formatFileName('{日期}.xlsx', '');
      const filePath = path.join(tempDir, xlsxName);
      await workbook.xlsx.writeFile(filePath);
      outputFiles.push(filePath);

      if (includeAttachments && attachedIds.size > 0 && fileIdFilenameMap.size > 0) {
        try {
          const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads';
          const attachmentFiles: Array<{ entryName: string; diskPath: string }> = [];
          for (const [aid, fn] of fileIdFilenameMap) {
            const diskPath = path.join(storageDir, fn);
            let realPath = diskPath;
            if (!fs.existsSync(realPath)) {
              const atRecords = await ctx.db.getRepository('attachments').find({ filter: { id: [aid] } });
              if (atRecords[0]?.path !== undefined) {
                realPath = path.join(storageDir, atRecords[0].path || '', fn);
              }
            }
            if (!fs.existsSync(realPath)) continue;
            const afName = attachFieldMap.get(aid) || '附件';
            const folderName = sanitizeSheetName(getFieldDisplayName(coll, afName));
            attachmentFiles.push({ entryName: `${folderName}/${fn}`, diskPath: realPath });
          }
          if (attachmentFiles.length > 0) {
            const zipName = collDisplay + '-' + formatFileName('{日期}.zip', '');
            const zipPath = path.join(tempDir, zipName);
            const zipOutput = fs.createWriteStream(zipPath);
            const zipArchive = archiver('zip', { zlib: { level: 9 } });
            await new Promise<void>((resolve, reject) => {
              zipArchive.on('error', reject);
              zipOutput.on('close', resolve);
              zipArchive.pipe(zipOutput);
              zipArchive.file(filePath, { name: path.basename(filePath) });
              for (const af of attachmentFiles) {
                zipArchive.file(af.diskPath, { name: af.entryName });
              }
              zipArchive.finalize();
            });
            try { fs.unlinkSync(filePath); } catch {}
            outputFiles[outputFiles.indexOf(filePath)] = zipPath;
          }
        } catch {}
      }

      await repo.update({
        filterByTk: task.id,
        values: { progress: Math.min(100, Math.floor((processedRows / Math.max(totalRows, 1)) * 100)), processedRows, totalRows },
      });
    }

    let finalFilePath: string;
    if (outputFiles.length === 0) {
      throw new Error('No data to export');
    } else if (outputFiles.length === 1) {
      finalFilePath = outputFiles[0];
    } else {
      const zipName = '全部数据表-' + formatFileName('{日期}.zip', '');
      finalFilePath = path.join(tempDir, zipName);
      const output = fs.createWriteStream(finalFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      await new Promise<void>((resolve, reject) => {
        try {
          output.on('close', resolve);
          archive.on('error', reject);
          archive.pipe(output);
          for (const fp of outputFiles) {
            archive.file(fp, { name: path.basename(fp) });
          }
          archive.finalize();
        } catch (err) {
          reject(err);
        }
      });
      for (const fp of outputFiles) {
        try { fs.unlinkSync(fp); } catch {}
      }
    }

    const stats = await fsp.stat(finalFilePath);
    const attachRepo = ctx.db.getRepository('attachments');
    const exportAttachment = await attachRepo.create({
      values: {
        title: path.basename(finalFilePath),
        filename: path.basename(finalFilePath),
        extname: path.extname(finalFilePath),
        mimetype: finalFilePath.endsWith('.zip')
          ? 'application/zip'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: stats.size,
        path: path.relative(process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads', finalFilePath).replace(/\\/g, '/'),
      },
    });

    await repo.update({
      filterByTk: task.id,
      values: {
        status: 'completed',
        progress: 100,
        processedRows,
        totalRows,
        exportFileId: exportAttachment.id,
        completedAt: new Date(),
      },
    });
  } catch (err: any) {
    await repo.update({
      filterByTk: task.id,
      values: {
        status: 'failed',
        errorMessage: err.message || String(err),
        completedAt: new Date(),
      },
    });
  } finally {
    release();
  }

  ctx.body = { taskId: task.id };
  await next();
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
