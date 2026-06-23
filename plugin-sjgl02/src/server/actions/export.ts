import { Context, Next } from '@nocobase/actions';
import ExcelJS from 'exceljs';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { Mutex } from 'async-mutex';

const exportMutex = new Mutex();

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:!@#\$%\^&\(\)]/g, '_').substring(0, 31);
}

function formatFileName(template: string, tableName: string): string {
  const date = new Date().toISOString().substring(0, 10);
  return template.replace(/\{表名\}/g, tableName).replace(/\{日期\}/g, date);
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  if (val instanceof Date) return val.toISOString();
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
  const fields = rawFields.map((f: any) => {
    let title = f.options?.uiSchema?.title || null;
    if (title && /^\{\{/.test(title)) title = null;
    return {
      name: f.name,
      type: f.type,
      uiSchema: { ...(f.options?.uiSchema || {}), title },
      interface: f.options?.interface || null,
      isRequired: autoFields.includes(f.name) ? false : f.options?.allowNull === false,
      isAssociation: ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes