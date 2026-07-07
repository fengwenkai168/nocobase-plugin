import { Context, Next } from '@nocobase/actions';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { resolveAttachmentFilePath } from './import-utils';
import { streamProcessExcel } from './excel-parser';
import { checkImportPermission } from './permission-check';
import { PermissionService } from '../services/permission-service';

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

export async function autoMatch(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { tableName, excelHeaders } = params;

  if (!tableName) {
    ctx.throw(400, 'tableName is required');
  }
  if (!excelHeaders || !Array.isArray(excelHeaders)) {
    ctx.throw(400, 'excelHeaders must be a non-empty array');
  }

  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, '数据表 ' + tableName + ' 不存在');
  }

  const rawFields: any[] = [];
  try {
    rawFields.push(...Array.from(coll.fields?.values() || coll.fields || []));
  } catch {
    // 忽略
  }

  const fieldNames = rawFields.map((f: any) => f.name);
  const fieldNameLowerSet = new Set(fieldNames.map((n: string) => n.toLowerCase()));

  const currentUser = ctx.state.currentUser;
  let allowedFields: Set<string> | null = null;

  if (currentUser) {
    try {
      const permService = new PermissionService(ctx.db);
      const perm = await permService.checkPermission(currentUser.id, tableName, 'import');
      if (perm.importFields && perm.importFields.length > 0) {
        allowedFields = new Set(perm.importFields);
      }
    } catch {
      // 权限校验失败不中断，仅跳过字段限制
    }
  }

  const mapping: Record<string, string> = {};
  for (const header of excelHeaders) {
    const headerKey = String(header).trim();
    const headerLower = headerKey.toLowerCase();

    if (fieldNameLowerSet.has(headerLower)) {
      const matchedName = fieldNames.find((n) => n.toLowerCase() === headerLower);
      if (matchedName && (!allowedFields || allowedFields.has(matchedName))) {
        mapping[headerKey] = matchedName;
      }
    }
  }

  ctx.body = { mapping };
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
      ctx.throw(400, 'Unsupported format: ' + ext + '. Only .xlsx, .xls, .csv allowed');
    }
    const filePath = await resolveAttachmentFilePath(ctx.db, attachment);
    if (!fs.existsSync(filePath)) {
      ctx.throw(404, 'File not found on disk');
    }

    const rawRows: any[][] = [];
    let headerColumns: string[] = [];
    let totalRows = 0;

    let sheets: string[] = [];
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
      sheetNames: sheets,
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
  const previewLimit = Math.min(
    parseInt(params.previewLimit || ctx.request.query?.previewLimit || '10', 10) || 10,
    100,
  );
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
      sheetName: sheetName || '',
      headerRow: headerRow || 1,
      importFileId: fileId,
      fileName: attachment.filename || attachment.title || '',
      uniqueFields: uniqueFields || [],
      requiredFields: perm.requiredFields || [],
      totalRows: 0,
      progress: 0,
      createdById: ctx.state.currentUser?.id,
      blankCellMode: blankCellMode || 'update',
    },
  });

  const taskId = task.id;

  ctx.body = { taskId };
  await next();

  // 触发导入调度器排队执行
  try {
    const { triggerImportScheduler } = await import('../workers/zombie-guard');
    triggerImportScheduler();
  } catch {
    /* 忽略 */
  }
}
