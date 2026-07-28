import path from 'node:path';
import { storagePathJoin } from '@nocobase/utils';
import type { Transaction } from 'sequelize';
import type Plugin from '../plugin';
import type { TaskHandlerContext } from './task-queue';
import type { FileKind } from './excel-parser';
import { ROW_LIMITS, iterateRows, yieldEventLoop } from './excel-parser';
import {
  BlankStrategy,
  ConvertContext,
  FieldConfig,
  FieldMeta,
  ImportMode,
  convertFieldValue,
  isBlank,
  isSystemField,
  parseDateValue,
} from './value-converter';
import {
  AttachmentIndex,
  attachmentExists,
  createAttachmentRecord,
  extractAttachmentArchive,
  getStorageInfo,
  isAllowedAttachment,
} from './attachment';
import { buildFieldMeta } from './field-meta';

export interface ImportMappingItem {
  field: string;
  source: 'excel' | 'custom' | 'ignore';
  columnIndex?: number;
  columnName?: string;
  value?: string;
  config?: FieldConfig;
}

export interface ImportTaskParams {
  filePath: string;
  fileName: string;
  fileKind: FileKind;
  sheetName: string;
  headerRow: number;
  collectionName: string;
  mode: ImportMode;
  uniqueFields: string[];
  blankStrategy: BlankStrategy;
  mapping: ImportMappingItem[];
  requiredFields: string[];
  attachmentArchivePath?: string;
  operatorUserId: number;
  plannedRows?: number;
}

interface RowError {
  row: number;
  field: string;
  reason: string;
  raw: unknown;
}

class ImportRowError extends Error {
  constructor(public detail: RowError) {
    super(`第 ${detail.row} 行 [${detail.field}] ${detail.reason}`);
  }
}

export class ImportFailedError extends Error {
  constructor(
    message: string,
    public details: Record<string, unknown>,
  ) {
    super(message);
  }
}

const BATCH_SIZE = 2000;
const RELATION_TYPES = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'];

interface PendingAttachment {
  rowPk: unknown;
  field: string;
  folder: string;
  fileNames: string[];
  updateMode: 'overwrite' | 'append';
  clear: boolean;
}

interface PreparedRow {
  rowNumber: number;
  values: Record<string, unknown>;
  hasRelations: boolean;
  uniqueFilter: Record<string, unknown> | null;
  attachments: Array<Omit<PendingAttachment, 'rowPk'>>;
}

export class ImportEngine {
  constructor(private plugin: Plugin) {}

  private get db() {
    return this.plugin.db;
  }

  buildFieldMeta(collectionName: string, fieldName: string): FieldMeta | null {
    return buildFieldMeta(this.db, collectionName, fieldName);
  }

  private getPkInfo(collectionName: string): { name: string; type: string; auto: boolean } {
    const collection = this.db.getCollection(collectionName);
    if (!collection) throw new Error(`数据表 ${collectionName} 不存在`);
    const name = (collection.options.filterTargetKey as string) || collection.model.primaryKeyAttribute || 'id';
    const field = collection.getField(name);
    const type = String(field?.options?.type || 'bigInt');
    const auto = ['integer', 'bigInt'].includes(type) || ['uuid', 'nanoid', 'snowflakeId', 'uid'].includes(type);
    return { name, type, auto };
  }

  async run(ctx: TaskHandlerContext, params: ImportTaskParams): Promise<Record<string, unknown>> {
    const collection = this.db.getCollection(params.collectionName);
    if (!collection) throw new Error(`数据表 ${params.collectionName} 不存在`);
    const repo = this.db.getRepository(params.collectionName);
    const pk = this.getPkInfo(params.collectionName);

    const effectiveMapping = params.mapping.filter((m) => m.source !== 'ignore');
    const metas = new Map<string, FieldMeta>();
    for (const item of effectiveMapping) {
      const meta = this.buildFieldMeta(params.collectionName, item.field);
      if (!meta) throw new Error(`字段 ${item.field} 在数据表 ${params.collectionName} 中不存在`);
      metas.set(item.field, meta);
    }
    for (const uniqueField of params.uniqueFields) {
      if (!effectiveMapping.some((m) => m.field === uniqueField)) {
        throw new Error(`唯一值字段 ${uniqueField} 必须已配置映射`);
      }
    }

    let attachmentIndex: AttachmentIndex | null = null;
    let tempDir: string | null = null;
    if (params.attachmentArchivePath) {
      tempDir = storagePathJoin(path.join('sjgl02', 'tmp', `task-${ctx.taskId}`));
      attachmentIndex = await extractAttachmentArchive(params.attachmentArchivePath, path.join(tempDir, 'attachments'));
    }

    const fieldConfigs: Record<string, FieldConfig> = {};
    for (const item of effectiveMapping) {
      if (item.config) fieldConfigs[item.field] = item.config;
    }
    const convertCtx: ConvertContext = {
      db: this.db,
      mode: params.mode,
      blankStrategy: params.blankStrategy,
      fieldConfigs,
      requiredFields: params.requiredFields || [],
      existsCache: new Map(),
      pkMetaCache: new Map(),
    };

    const errors: RowError[] = [];
    const previewRows: Array<Record<string, unknown>> = [];
    let totalRows = 0;
    let successRows = 0;
    const pkSeen = new Set<unknown>();
    const pkMapping = effectiveMapping.find((m) => m.field === pk.name);
    const pkIsManual = !pk.auto;
    // 追加更新（append）的关联字段：仅 update/upsert 且多值关联生效
    const appendFields =
      params.mode === 'insert'
        ? []
        : effectiveMapping.filter((m) => {
            if (m.config?.updateMode !== 'append') return false;
            const meta = metas.get(m.field);
            return meta && (meta.type === 'hasMany' || meta.type === 'belongsToMany');
          });

    if (pkIsManual && !pkMapping) {
      throw new Error(`数据表 ${params.collectionName} 主键(${pk.name})为手动型(${pk.type})，必须映射主键列`);
    }
    if (params.mode !== 'insert' && params.uniqueFields.length === 0) {
      throw new Error('update/upsert 模式必须至少选择 1 个唯一值字段');
    }

    const transaction: Transaction = await this.db.sequelize.transaction();
    const writeContext = { state: { currentUser: { id: params.operatorUserId } } } as never;
    const pendingAttachments: PendingAttachment[] = [];
    try {
      let insertBuffer: Array<Record<string, unknown>> = [];
      const flushInserts = async () => {
        if (!insertBuffer.length) return;
        await collection.model.bulkCreate(insertBuffer, { transaction, context: writeContext } as never);
        insertBuffer = [];
      };

      for await (const row of iterateRows(params.filePath, params.fileKind, params.sheetName, params.headerRow)) {
        ctx.throwIfAborted();
        totalRows += 1;
        if (totalRows > ROW_LIMITS[params.fileKind]) {
          throw new Error(`文件行数超过 ${params.fileKind} 格式上限 ${ROW_LIMITS[params.fileKind]} 行`);
        }
        // 周期性让出事件循环，避免大批量导入阻塞 API 请求
        if (totalRows % 200 === 0) await yieldEventLoop();
        const prepared = await this.prepareRow(
          row.rowNumber,
          row.values,
          effectiveMapping,
          metas,
          convertCtx,
          params,
          attachmentIndex,
          pk,
          pkMapping,
        );
        if (previewRows.length < 10) previewRows.push(prepared.values);

        if (pkMapping && params.mode !== 'update') {
          const pkValue = prepared.values[pk.name];
          if (isBlank(pkValue))
            throw new ImportRowError({ row: row.rowNumber, field: pk.name, reason: '手动型主键值为空', raw: pkValue });
          if (pkSeen.has(pkValue))
            throw new ImportRowError({
              row: row.rowNumber,
              field: pk.name,
              reason: '主键值与本批次其他行重复',
              raw: pkValue,
            });
          pkSeen.add(pkValue);
        }

        if (params.mode === 'insert') {
          if (prepared.hasRelations || prepared.attachments.length) {
            await flushInserts();
            const created = await repo.create({ values: prepared.values, transaction, context: writeContext } as never);
            for (const att of prepared.attachments) pendingAttachments.push({ rowPk: created.get(pk.name), ...att });
          } else {
            insertBuffer.push(prepared.values);
            if (insertBuffer.length >= BATCH_SIZE) await flushInserts();
          }
          successRows += 1;
        } else {
          await flushInserts();
          // 批量预加载优化：用 existCache 缓存唯一值查询结果，避免重复唯一值重复查库
          let existing: { get: (key: string) => unknown } | null = null;
          if (prepared.uniqueFilter) {
            const uniqueKey = JSON.stringify(prepared.uniqueFilter);
            if (convertCtx.existsCache.has(`__unique__${uniqueKey}`)) {
              existing = convertCtx.existsCache.get(`__unique__${uniqueKey}`) as { get: (key: string) => unknown } | null;
            } else {
              existing = await repo.findOne({
                filter: prepared.uniqueFilter,
                appends: appendFields.length ? appendFields.map((f) => f.field) : undefined,
                transaction,
              }) as { get: (key: string) => unknown } | null;
              convertCtx.existsCache.set(`__unique__${uniqueKey}`, existing);
            }
          }
          if (existing) {
            if (appendFields.length) {
              await this.mergeAppendRelations(existing, prepared.values, appendFields, metas);
            }
            await repo.update({
              filter: prepared.uniqueFilter!,
              values: prepared.values,
              transaction,
              context: writeContext,
            } as never);
            for (const att of prepared.attachments) pendingAttachments.push({ rowPk: existing.get(pk.name), ...att });
          } else if (params.mode === 'upsert') {
            const created = await repo.create({ values: prepared.values, transaction, context: writeContext } as never);
            for (const att of prepared.attachments) pendingAttachments.push({ rowPk: created.get(pk.name), ...att });
          }
          successRows += 1;
        }

        if (totalRows % BATCH_SIZE === 0) {
          await ctx.updateProgress(totalRows);
          await ctx.updateStats({ totalRows, successRows });
        }
      }
      await flushInserts();
      await transaction.commit();
      await ctx.updateStats({ totalRows, successRows });
      await ctx.updateProgress(totalRows, totalRows);

      const attachmentResult = await this.processAttachments(ctx, pendingAttachments, attachmentIndex, params, pk.name);

      return {
        totalRows,
        successRows,
        errorRows: 0,
        errors: [],
        previewRows,
        attachments: attachmentResult,
      };
    } catch (error) {
      await transaction.rollback();
      if (error instanceof Error && error.message === '__aborted__') {
        throw error;
      }
      if (error instanceof ImportRowError) {
        errors.push(error.detail);
      }
      if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError' && pkMapping) {
        errors.push({ row: 0, field: pk.name, reason: '主键值与数据库已有记录重复', raw: null });
      }
      const message = errors.length
        ? `导入失败：${errors[0].reason}（字段 ${errors[0].field}${
            errors[0].row ? `，第 ${errors[0].row} 行` : ''
          }），已整批回滚`
        : `导入失败：${error instanceof Error ? error.message : String(error)}，已整批回滚`;
      throw new ImportFailedError(message, {
        totalRows,
        successRows: 0,
        errorRows: totalRows,
        errors: errors.slice(0, 100),
        previewRows,
        rolledBack: true,
      });
    }
  }

  private async prepareRow(
    rowNumber: number,
    values: unknown[],
    mapping: ImportMappingItem[],
    metas: Map<string, FieldMeta>,
    convertCtx: ConvertContext,
    params: ImportTaskParams,
    attachmentIndex: AttachmentIndex | null,
    pk: { name: string; type: string; auto: boolean },
    pkMapping: ImportMappingItem | undefined,
  ): Promise<PreparedRow> {
    const out: Record<string, unknown> = {};
    let hasRelations = false;
    const attachments: Array<Omit<PendingAttachment, 'rowPk'>> = [];
    const uniqueFilter: Record<string, unknown> = {};

    for (const item of mapping) {
      const meta = metas.get(item.field)!;
      const raw = item.source === 'custom' ? item.value : values[item.columnIndex ?? -1];

      if (meta.attachment) {
        const cfg: FieldConfig = item.config || {};
        if (params.attachmentArchivePath) {
          if (isBlank(raw)) {
            // 空值处理：clear → 清空该字段（删除附件）；默认跳过不更新（保留原附件）
            if (cfg.emptyStrategy === 'clear' && params.mode !== 'insert') {
              attachments.push({ field: item.field, folder: '', fileNames: [], updateMode: 'overwrite', clear: true });
            }
          } else {
            if (!cfg.folder) {
              throw new ImportRowError({
                row: rowNumber,
                field: item.field,
                reason: '附件字段未选择压缩包内文件夹',
                raw,
              });
            }
            const inputNames = String(raw)
              .split(/[,，]/)
              .map((v) => v.trim())
              .filter(Boolean);
            const fileNames: string[] = [];
            for (const fileName of inputNames) {
              if (!isAllowedAttachment(fileName)) {
                throw new ImportRowError({
                  row: rowNumber,
                  field: item.field,
                  reason: '文件格式不被系统允许',
                  raw: fileName,
                });
              }
              if (!attachmentExists(attachmentIndex!, cfg.folder, fileName)) {
                // 匹配不到处理：skip → 跳过该附件（单文件跳过，其余正常导入）
                if (cfg.notFound === 'skip') continue;
                throw new ImportRowError({
                  row: rowNumber,
                  field: item.field,
                  reason: `文件夹 ${cfg.folder} 下找不到对应的文件名`,
                  raw: fileName,
                });
              }
              fileNames.push(fileName);
            }
            if (fileNames.length) {
              attachments.push({
                field: item.field,
                folder: cfg.folder,
                fileNames,
                updateMode: cfg.updateMode === 'append' && params.mode !== 'insert' ? 'append' : 'overwrite',
                clear: false,
              });
            }
          }
        } else if (!isBlank(raw)) {
          throw new ImportRowError({ row: rowNumber, field: item.field, reason: '未上传附件压缩包但附件列有值', raw });
        }
        continue;
      }

      if (isSystemField(item.field)) {
        if (item.field === 'createdAt' || item.field === 'updatedAt') {
          if (!isBlank(raw)) {
            const date = parseDateValue(raw);
            if (!date) throw new ImportRowError({ row: rowNumber, field: item.field, reason: '日期格式无法解析', raw });
            out[item.field] = date;
          }
        } else {
          if (!isBlank(raw)) {
            const userId = Number(raw);
            if (!Number.isInteger(userId))
              throw new ImportRowError({ row: rowNumber, field: item.field, reason: '用户ID格式错误', raw });
            const cacheKey = `users:${userId}`;
            if (!convertCtx.existsCache.has(cacheKey)) {
              const exists = await this.db.getRepository('users').findOne({ filter: { id: userId }, fields: ['id'] });
              convertCtx.existsCache.set(cacheKey, !!exists);
            }
            if (!convertCtx.existsCache.get(cacheKey))
              throw new ImportRowError({ row: rowNumber, field: item.field, reason: '填写的用户ID在系统中不存在', raw });
            out[item.field] = userId;
          }
        }
        continue;
      }

      const result = await convertFieldValue(meta, raw, convertCtx);
      if (result.status === 'error') {
        throw new ImportRowError({ row: rowNumber, field: item.field, reason: result.error!, raw });
      }
      if (result.status === 'skip') continue;
      if (RELATION_TYPES.includes(meta.type)) hasRelations = true;
      out[item.field] = result.value;
    }

    const now = new Date();
    if (params.mode === 'insert' || params.mode === 'upsert') {
      if (!('createdAt' in out)) out.createdAt = now;
      if (!('createdById' in out)) out.createdById = params.operatorUserId;
    }
    if (!('updatedAt' in out)) out.updatedAt = now;
    if (!('updatedById' in out)) out.updatedById = params.operatorUserId;

    if (params.mode !== 'insert') {
      for (const uniqueField of params.uniqueFields) {
        const value = out[uniqueField];
        if (isBlank(value)) {
          throw new ImportRowError({
            row: rowNumber,
            field: uniqueField,
            reason: '唯一值字段为空（update/upsert 模式不允许）',
            raw: value,
          });
        }
        uniqueFilter[uniqueField] = value;
      }
    }

    return {
      rowNumber,
      values: out,
      hasRelations,
      uniqueFilter: params.mode === 'insert' ? null : uniqueFilter,
      attachments,
    };
  }

  private async mergeAppendRelations(
    existing: unknown,
    values: Record<string, unknown>,
    appendFields: ImportMappingItem[],
    metas: Map<string, FieldMeta>,
  ): Promise<void> {
    const record = existing as { get: (key: string) => unknown };
    for (const item of appendFields) {
      const incoming = values[item.field];
      if (!Array.isArray(incoming) || !incoming.length) continue;
      const meta = metas.get(item.field);
      if (!meta?.target) continue;
      const targetPk = this.getPkInfo(meta.target).name;
      const current = record.get(item.field);
      const currentIds = (Array.isArray(current) ? current : []).map((r) => {
        const m = r as { get?: (key: string) => unknown; id?: unknown };
        return typeof m?.get === 'function' ? m.get(targetPk) : m?.id ?? r;
      });
      const merged: unknown[] = [...currentIds];
      for (const v of incoming) {
        if (!merged.some((x) => String(x) === String(v))) merged.push(v);
      }
      values[item.field] = merged;
    }
  }

  private async processAttachments(
    ctx: TaskHandlerContext,
    pending: PendingAttachment[],
    index: AttachmentIndex | null,
    params: ImportTaskParams,
    pkName: string,
  ): Promise<Record<string, unknown>> {
    if (!pending.length || !index) return { uploaded: 0 };
    const repo = this.db.getRepository(params.collectionName);
    const storageInfo = await getStorageInfo(this.db);
    let uploaded = 0;
    let processed = 0;
    const warnings: string[] = [];
    for (const item of pending) {
      ctx.throwIfAborted();
      processed += 1;
      if (processed % 50 === 0) await yieldEventLoop();
      try {
        const recordIds: unknown[] = [];
        for (const fileName of item.fileNames) {
          const filePath = path.join(index.dir, item.folder, fileName);
          const record = await createAttachmentRecord(this.db, filePath, fileName, storageInfo);
          recordIds.push(record.id);
        }
        let finalIds = recordIds;
        if (item.updateMode === 'append' && !item.clear) {
          // 追加更新：读取原有附件并合并，不删除原有
          const existing = await repo.findOne({ filterByTk: item.rowPk, appends: [item.field] } as never);
          const oldItems =
            (existing?.get(item.field) as Array<{ get?: (key: string) => unknown; id?: unknown }> | undefined) || [];
          const oldIds = oldItems.map((r) => (typeof r?.get === 'function' ? r.get('id') : r?.id ?? r));
          finalIds = [...new Set([...oldIds, ...recordIds])];
        }
        await repo.update({
          filter: { [pkName]: item.rowPk },
          values: { [item.field]: finalIds },
        });
        uploaded += recordIds.length;
      } catch (error) {
        warnings.push(
          `行主键 ${item.rowPk} 字段 ${item.field}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { uploaded, warnings };
  }
}
