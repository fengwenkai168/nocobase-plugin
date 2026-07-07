import { Context, Next } from '@nocobase/actions';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { checkExportPermission } from './permission-check';
import { getFieldDisplayName } from '../workers/worker-utils';

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
  const { tableName, permSource } = params;
  if (!tableName || tableName === '__all__') {
    ctx.body = { estimatedRows: 0 };
    await next();
    return;
  }
  const exportPerm = await checkExportPermission(ctx, tableName, permSource);
  if (!exportPerm.canExport) {
    ctx.throw(403, 'Access denied');
  }
  const repo = ctx.db.getRepository(tableName);
  const count = repo ? await repo.count({ filter: {} }) : 0;
  ctx.body = { estimatedRows: count };
  await next();
}

export async function executeExport(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const {
    tableName,
    selectedFields,
    associationDisplayMode,
    includeAssociationSheet,
    associationSheetTables,
    fileNameTemplate,
    includeAttachments,
    headerStyle,
    permSource,
  } = params;

  if (!tableName) {
    ctx.throw(400, 'tableName is required');
  }

  if (tableName !== '__all__') {
    const exportPerm = await checkExportPermission(ctx, tableName, permSource);
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
        const permCheck = await checkExportPermission(ctx, name, permSource);
        if (permCheck.canExport) names.push(name);
      } catch {
        /* 忽略 */
      }
    }
    allowedTableList = names;
  }

  let estimatedTotal = 0;
  try {
    if (tableName === '__all__' && allowedTableList) {
      for (const t of allowedTableList) {
        try {
          const repo = ctx.db.getRepository(t);
          if (repo) estimatedTotal += await repo.count({ filter: {} });
        } catch {
          /* 忽略 */
        }
      }
    } else {
      const tRepo = ctx.db.getRepository(tableName);
      if (tRepo) estimatedTotal = await tRepo.count({ filter: {} });
    }
  } catch {
    /* 忽略 */
  }

  const repo = ctx.db.getRepository('sjgl02_tasks');

  if (tableName === '__all__' && allowedTableList && allowedTableList.length > 0) {
    // 全部数据表：创建 1 条任务，selectedFields 存储表列表配置
    const tableListConfig = allowedTableList.map((t) => ({ tableName: t, fields: selectedFields || [] }));
    const task = await repo.create({
      values: {
        taskType: 'export',
        tableName: '__all__',
        status: 'pending',
        selectedFields: tableListConfig,
        headerStyle: headerStyle || 'title_id',
        permSource: permSource || null,
        createdById: ctx.state.currentUser?.id,
        totalRows: estimatedTotal,
        progress: 0,
        includeAttachments: includeAttachments || false,
        fileNameTemplate: fileNameTemplate || '',
      },
    });
    ctx.body = { taskId: task.id };
    await next();
    try {
      const { triggerExportScheduler } = await import('../workers/zombie-guard');
      triggerExportScheduler();
    } catch {
      /* 忽略 */
    }
    return;
  }

  // 单表导出
  const task = await repo.create({
    values: {
      taskType: 'export',
      tableName,
      status: 'pending',
      selectedFields: selectedFields || [],
      permSource: permSource || null,
      associationDisplayMode: associationDisplayMode || {},
      includeAssociationSheet: includeAssociationSheet || false,
      associationSheetTables: associationSheetTables || [],
      includeAttachments: includeAttachments || false,
      totalRows: estimatedTotal,
      progress: 0,
      fileName: '',
      createdById: ctx.state.currentUser?.id,
      headerStyle: headerStyle || 'title_id',
      fileNameTemplate: fileNameTemplate || '',
    },
  });

  ctx.body = { taskId: task.id };
  await next();

  // 触发调度器检查，如果没有 processing 的任务则立即启动
  try {
    const { triggerExportScheduler } = await import('../workers/zombie-guard');
    triggerExportScheduler();
  } catch {
    /* 忽略 */
  }
}

/**
 * 从 worker 生成的临时文件创建 attachment 记录，并重命名为可读文件名。
 * 由 zombie-guard 的 onWorkerExit 调用。
 */
export async function resolveAttachmentFromFile(db: any, tempFilePath: string, taskId: number): Promise<number | null> {
  try {
    const storageDir = process.env.STORAGE_DIR || 'storage/uploads';
    let absPath: string;
    if (path.isAbsolute(tempFilePath)) {
      absPath = tempFilePath;
    } else if (tempFilePath.includes('/') || tempFilePath.includes('\\')) {
      absPath = tempFilePath;
    } else {
      absPath = path.join(storageDir, 'exports', tempFilePath);
    }
    absPath = path.resolve(absPath);
    if (!fs.existsSync(absPath)) return null;

    const stats = await fsp.stat(absPath);
    const attachRepo = db.getRepository('attachments');
    const fileName = path.basename(absPath);
    const attachment = await attachRepo.create({
      values: {
        title: fileName,
        filename: fileName,
        extname: path.extname(absPath),
        mimetype: resolveMimeType(absPath),
        size: stats.size,
        path: path.relative(storageDir, absPath).replace(/\\/g, '/'),
      },
    });
    return attachment.id;
  } catch {
    return null;
  }
}

function resolveMimeType(absPath: string): string {
  if (absPath.endsWith('.tar.gz')) return 'application/gzip';
  if (absPath.endsWith('.zip')) return 'application/zip';
  if (absPath.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
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
  const currentUserId = ctx.state.currentUser?.id;
  const isAdmin = (ctx.state.currentUser?.roles || []).some((r: any) => r.name === 'admin' || r.name === 'root');
  if (!isAdmin && task.createdById !== currentUserId) {
    ctx.throw(403, 'Access denied');
  }
  if (!task.exportFileId) {
    ctx.throw(404, 'Export file not found');
  }
  const attachRepo = ctx.db.getRepository('attachments');
  const attachment = await attachRepo.findOne({ filter: { id: task.exportFileId } });
  if (!attachment) {
    ctx.throw(404, 'Attachment record not found');
  }
  const storageDir = process.env.STORAGE_DIR || 'storage/uploads';
  const filePath = path.join(storageDir, attachment.path ?? attachment.filename);
  if (!fs.existsSync(filePath)) {
    ctx.throw(404, 'File not found on disk');
  }
  const fileName = attachment.title || attachment.filename || 'export.xlsx';
  ctx.attachment(fileName);
  ctx.set('Content-Type', attachment.mimetype || 'application/octet-stream');
  ctx.body = fs.createReadStream(filePath);
  await next();
}
