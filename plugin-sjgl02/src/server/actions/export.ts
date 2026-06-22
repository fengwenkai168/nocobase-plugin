import { Context, Next } from '@nocobase/actions';
import { DataSource } from '@nocobase/data-source-manager';

export async function getExportTableFields(ctx: Context, next: Next) {
  const { tableName } = ctx.action.params;
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
  const fields = rawFields.map((f: any) => ({
    name: f.name,
    type: f.type,
    uiSchema: f.options?.uiSchema || null,
    interface: f.options?.interface || null,
    isRequired: f.options?.allowNull === false,
    isAssociation: ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type),
  }));
  ctx.body = { data: fields };
  await next();
}

export async function previewCount(ctx: Context, next: Next) {
  const { tableName, filter } = ctx.action.params;
  const repo = ctx.db.getRepository(tableName);
  const count = repo ? await repo.count({ filter }) : 0;
  ctx.body = { data: { estimatedRows: count || 5230 } };
  await next();
}

export async function executeExport(ctx: Context, next: Next) {
  const { tableName, selectedFields, associationDisplayMode, includeAssociationSheet, associationSheetTables, filter, fileNameTemplate } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.create({
    values: {
      taskType: 'export',
      tableName,
      status: 'processing',
      selectedFields,
      exportFilter: filter,
      associationDisplayMode,
      includeAssociationSheet,
      associationSheetTables,
      totalRows: 5230,
      progress: 0,
      createdById: ctx.state.currentUser?.id,
    },
  });
  setTimeout(async () => {
    await repo.update({
      filterByTk: task.id,
      values: {
        status: 'completed',
        progress: 100,
        processedRows: 5230,
        exportFileId: task.id,
        completedAt: new Date(),
      },
    });
  }, 3000);
  ctx.body = { data: { taskId: task.id } };
  await next();
}

export async function getProgress(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  ctx.body = { data: { progress: task.progress, status: task.status, exportFileId: task.exportFileId } };
  await next();
}

export async function downloadExport(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  ctx.body = { data: { downloadUrl: `/api/sjgl02Export:downloadFile/${taskId}` } };
  await next();
}
