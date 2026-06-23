import { Context, Next } from '@nocobase/actions';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

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
  const autoFields = ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'createdById', 'updatedById'];
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
    };
  });
  ctx.body = fields;
  await next();
}

export async function uploadParse(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { fileId } = params;
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
    const firstSheet = sheets[0];
    const ws = workbook.Sheets[firstSheet];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const headerColumns = (rows[0] || []).map((h: any) => String(h));
    ctx.body = {
      sheets,
      headerColumns,
      fileId,
      fileName: attachment.filename || attachment.title,
    };
  } catch (err: any) {
    if (err.status) throw err;
    ctx.throw(500, 'Failed to parse file: ' + err.message);
  }
  await next();
}

export async function preview(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { fileId, sheetName, headerRow } = params;
  if (!fileId) {
    ctx.throw(400, 'fileId is requi