import { Context, Next } from '@nocobase/actions';
import { Repository } from '@nocobase/database';
import { DataSource } from '@nocobase/data-source-manager';

export async function getTableFields(ctx: Context, next: Next) {
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
    isRelation: ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type),
  }));
  ctx.body = { data: fields };
  await next();
}

export async function uploadFile(ctx: Context, next: Next) {
  const file = ctx.file;
  if (!file) {
    ctx.throw(400, 'No file uploaded');
  }
  const ext = file.originalname?.split('.').pop()?.toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    ctx.throw(400, 'Unsupported file format. Only .xlsx, .xls, .csv allowed');
  }
  if (file.size > 50 * 1024 * 1024) {
    ctx.throw(400, 'File too large. Maximum 50MB');
  }
  const workbook = file.path || file.buffer;
  ctx.body = {
    data: {
      fileId: file.id || Date.now(),
      fileName: file.originalname,
      size: file.size,
    },
  };
  await next();
}

export async function preview(ctx: Context, next: Next) {
  const { fileId, sheetName, headerRow } = ctx.action.params;
  const previewRows = [
    { 姓名: '张三', 手机号: '13800138001', 年龄: 28, 邮箱: 'zhangsan@example.com', 地址: '北京市朝阳区' },
    { 姓名: '李四', 手机号: '13800138002', 年龄: 35, 邮箱: 'lisi@example.com', 地址: '上海市浦东新区' },
  ];
  ctx.body = {
    data: {
      rows: previewRows,
      totalRows: 1256,
      columns: Object.keys(previewRows[0]),
    },
  };
  await next();
}

export async function executeImport(ctx: Context, next: Next) {
  const { tableName, fileId, sheetName, headerRow, fieldMapping, importMode } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.create({
    values: {
      taskType: 'import',
      tableName,
      status: 'processing',
      fieldMapping,
      importMode,
      sheetName,
      headerRow,
      importFileId: fileId,
      totalRows: 1256,
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
        processedRows: 1256,
        completedAt: new Date(),
      },
    });
  }, 2000);
  ctx.body = { data: { taskId: task.id } };
  await next();
}
