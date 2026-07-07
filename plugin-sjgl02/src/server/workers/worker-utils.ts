import path from 'path';
import type { FieldMeta, AssociationSheetConfig } from './types';

/** 解析临时导出目录 */
export function resolveTempDir(): string {
  const storageDir = process.env.STORAGE_DIR || 'storage/uploads';
  return path.join(storageDir, 'exports');
}

/** 清洗 Sheet 名称（Excel 限制 31 字符，禁止特殊字符） */
export function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/:*?[\]:!@#$%^&()]/g, '_').substring(0, 31);
}

/** 获取标量字段名列表（排除关联字段） */
export function getScalarFieldNames(coll: any): string[] {
  if (!coll) return [];
  const names: string[] = [];
  try {
    for (const f of Array.from(coll.fields?.values?.() || coll.fields || [])) {
      const type = (f as any).type;
      if (!['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(type)) {
        names.push((f as any).name);
      }
    }
  } catch {
    /* 忽略 */
  }
  return names;
}

/** 获取指定类型的关联字段名列表 */
export function getRelationFieldNames(coll: any, types: string[]): string[] {
  if (!coll) return [];
  const names: string[] = [];
  try {
    for (const f of Array.from(coll.fields?.values?.() || coll.fields || [])) {
      if (types.includes((f as any).type)) {
        names.push((f as any).name);
      }
    }
  } catch {
    /* 忽略 */
  }
  return names;
}

/** 获取字段的显示名称（根据 style 决定格式） */
export function getFieldDisplayName(coll: any, fieldName: string, style?: string): string {
  try {
    const f = coll.fields instanceof Map ? coll.fields.get(fieldName) : null;
    const title = f?.options?.uiSchema?.title;
    if (title && !/^\{\{/.test(title)) {
      if (style === 'id') return fieldName;
      if (style === 'title') return title;
      return `${title}(${fieldName})`;
    }
  } catch {
    /* 忽略 */
  }
  return fieldName;
}

/** 获取集合的显示名称（根据 style 决定格式） */
export function getCollDisplayName(coll: any, style?: string): string {
  const rawName = coll?.name || '';
  let title = coll?.options?.title || rawName;
  if (/^\{\{/.test(title)) title = rawName;
  if (style === 'id') return rawName;
  if (style === 'title') return title;
  return title !== rawName ? `${title}(${rawName})` : rawName;
}

/** 检测主键策略（cursor/uuid/offset） */
export function detectPkStrategy(coll: any): { strategy: 'cursor' | 'uuid' | 'offset'; pkField: string | null } {
  try {
    const pkAttrs: string[] = coll.model?.primaryKeyAttributes || [];
    if (pkAttrs.length === 1) {
      const name = pkAttrs[0];
      const field = coll.fields?.get?.(name) || coll.fields?.[name];
      const type = String((field as any)?.type || 'other').toLowerCase();
      if (type.includes('uuid')) return { strategy: 'uuid', pkField: name };
      if ((type.includes('int') || type === 'bigint') && coll.model?.rawAttributes?.[name]?.autoIncrement) {
        return { strategy: 'cursor', pkField: name };
      }
      return { strategy: 'offset', pkField: name };
    }
  } catch {
    /* 忽略 */
  }
  return { strategy: 'offset', pkField: null };
}

/** 获取附件字段名列表（belongsToMany + interface=attachment） */
export function getAttachFieldNames(coll: any): string[] {
  if (!coll) return [];
  const names: string[] = [];
  try {
    for (const f of Array.from(coll.fields?.values?.() || coll.fields || [])) {
      if ((f as any).type === 'belongsToMany' && (f as any).options?.interface === 'attachment') {
        names.push((f as any).name);
      }
    }
  } catch {
    /* 忽略 */
  }
  return names;
}

/** 获取 FileId 字段名列表（integer 类型且名称以 FileId 结尾） */
export function getFileIdFieldNames(coll: any): string[] {
  if (!coll) return [];
  const names: string[] = [];
  try {
    for (const f of Array.from(coll.fields?.values?.() || coll.fields || [])) {
      if ((f as any).type === 'integer' && /FileId$/.test((f as any).name)) {
        names.push((f as any).name);
      }
    }
  } catch {
    /* 忽略 */
  }
  return names;
}

/** 判断字段是否为附件字段 */
function isAttachmentField(f: any): boolean {
  if (f.type === 'belongsToMany' && f.options?.interface === 'attachment') return true;
  if (f.type === 'integer' && /FileId$/.test(f.name)) return true;
  return false;
}

/** 从集合中提取所有字段元数据 */
export function getFieldMetas(coll: any, selectedFields?: string[]): FieldMeta[] {
  if (!coll) return [];
  const metas: FieldMeta[] = [];
  try {
    const fields = Array.from(coll.fields?.values?.() || coll.fields || []);
    for (const f of fields) {
      const name = (f as any).name;
      if (selectedFields && selectedFields.length > 0 && !selectedFields.includes(name)) continue;
      const type = String((f as any).type || 'string');
      const isRelation = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(type);
      const isAttachment = isAttachmentField(f);
      const isScalar = !isRelation && !isAttachment;
      const meta: FieldMeta = {
        name,
        type,
        isScalar,
        isRelation,
        isAttachment,
        interface: (f as any).options?.interface || null,
      };
      if (isRelation || isAttachment) {
        meta.target = (f as any).options?.target;
        meta.foreignKey = (f as any).options?.foreignKey;
        meta.otherKey = (f as any).options?.otherKey;
        meta.through = (f as any).options?.through;
      }
      metas.push(meta);
    }
  } catch {
    // ignore
  }
  return metas;
}

/** 获取指定字段的 FieldMeta */
export function getFieldMeta(coll: any, fieldName: string): FieldMeta | null {
  const metas = getFieldMetas(coll);
  return metas.find((m) => m.name === fieldName) || null;
}

/** 获取关联表 sheet 配置 */
export function getAssociationSheetConfigs(
  db: any,
  coll: any,
  selectedFields: string[],
  associationSheetTables: string[],
  headerStyle?: string,
): AssociationSheetConfig[] {
  const configs: AssociationSheetConfig[] = [];
  if (!coll || !associationSheetTables || associationSheetTables.length === 0) return configs;
  try {
    const relationFields = getFieldMetas(coll).filter(
      (m) => m.isRelation && selectedFields.includes(m.name) && associationSheetTables.includes(m.name),
    );
    for (const meta of relationFields) {
      if (!meta.target) continue;
      const targetColl = db.getCollection?.(meta.target);
      if (!targetColl) continue;
      const targetFields = getScalarFieldNames(targetColl);
      if (!targetFields.length) continue;
      const targetFieldHeaders: Record<string, string> = {};
      for (const f of targetFields) {
        targetFieldHeaders[f] = getFieldDisplayName(targetColl, f, headerStyle);
      }
      configs.push({
        fieldName: meta.name,
        targetTable: meta.target,
        displayName: getCollDisplayName(targetColl, headerStyle),
        targetFields,
        targetFieldHeaders,
      });
    }
  } catch {
    // ignore
  }
  return configs;
}
