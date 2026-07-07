import { quoteIdentifier } from './export-worker-utils';
import type { FieldMeta } from './types';

export interface AttachmentInfo {
  id: string | number;
  filename: string;
  path: string;
}

export interface AttachmentCollectOptions {
  sequelize: any;
  tableName: string;
  fieldMetas: FieldMeta[];
  mainIds: (string | number)[];
  includeAttachments: boolean;
}

export async function collectAttachmentIds(options: AttachmentCollectOptions): Promise<AttachmentInfo[]> {
  const { sequelize, fieldMetas, includeAttachments } = options;
  if (!includeAttachments) return [];

  const attachmentFields = fieldMetas.filter((m) => m.isAttachment);
  if (attachmentFields.length === 0) return [];

  const attachmentIdSet = new Set<string | number>();

  for (const meta of attachmentFields) {
    if (meta.type === 'integer') {
      const rows = await queryColumn(sequelize, options.tableName, meta.name);
      for (const r of rows) {
        const v = r[meta.name];
        if (v !== null && v !== undefined) attachmentIdSet.add(v);
      }
      continue;
    }

    if (meta.type === 'belongsToMany' && meta.through && meta.otherKey) {
      const rows = await queryBelongsToMany(
        sequelize,
        meta.through,
        meta.foreignKey || `${options.tableName}Id`,
        meta.otherKey,
        options.mainIds,
      );
      for (const r of rows) {
        const v = r[meta.otherKey];
        if (v !== null && v !== undefined) attachmentIdSet.add(v);
      }
    }
  }

  if (attachmentIdSet.size === 0) return [];
  return queryAttachmentInfos(sequelize, Array.from(attachmentIdSet));
}

async function queryColumn(sequelize: any, tableName: string, columnName: string): Promise<any[]> {
  try {
    const sql = `SELECT ${quoteIdentifier(columnName)} FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(
      columnName,
    )} IS NOT NULL`;
    const [rows] = (await sequelize.query(sql)) as any;
    return rows || [];
  } catch {
    return [];
  }
}

async function queryBelongsToMany(
  sequelize: any,
  through: string,
  foreignKey: string,
  otherKey: string,
  mainIds: (string | number)[],
): Promise<any[]> {
  try {
    if (mainIds.length === 0) return [];
    const placeholders = mainIds.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT ${quoteIdentifier(foreignKey)}, ${quoteIdentifier(
      otherKey,
    )} FROM ${quoteIdentifier(through)} WHERE ${quoteIdentifier(foreignKey)} IN (${placeholders})`;
    const [rows] = (await sequelize.query(sql, { bind: mainIds })) as any;
    return rows || [];
  } catch {
    return [];
  }
}

async function queryAttachmentInfos(sequelize: any, ids: (string | number)[]): Promise<AttachmentInfo[]> {
  if (ids.length === 0) return [];
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT id, filename, path FROM ${quoteIdentifier('attachments')} WHERE id IN (${placeholders})`;
    const [rows] = (await sequelize.query(sql, { bind: ids })) as any;
    return (rows || []).map((r: any) => ({
      id: r.id,
      filename: r.filename || `attachment_${r.id}`,
      path: r.path || '',
    }));
  } catch {
    return [];
  }
}
