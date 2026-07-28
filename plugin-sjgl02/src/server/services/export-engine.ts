import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import Excel from 'exceljs';
import * as tar from 'tar-stream';
import { storagePathJoin } from '@nocobase/utils';
import type Plugin from '../plugin';
import type { TaskHandlerContext } from './task-queue';
import type { FieldMeta } from './value-converter';
import { buildFieldMeta, listExportableFields } from './field-meta';
import { yieldEventLoop } from './excel-parser';
import {
  RelationFormat,
  formatBooleanValue,
  formatDateValue,
  formatMultiSelectValue,
  formatRelationRecord,
  formatSelectValue,
  getTitleField,
} from './export-format';

export interface ExportFieldConfig {
  field: string;
  dateFormat?: string;
  relationFormat?: RelationFormat;
}

export interface ExportTaskParams {
  collectionName: string;
  allTables?: boolean;
  fields: ExportFieldConfig[];
  headerType: 'titleName' | 'title' | 'name';
  filter?: Record<string, unknown> | null;
  exportFilter?: Record<string, unknown> | null;
  relationFields?: string[];
  relationExportMode?: 'sheet' | 'file';
  exportAttachment?: boolean;
  globalDateFormat?: string;
  globalRelationFormat?: RelationFormat;
  operatorUserId: number;
}

const ROWS_PER_FILE = 1_000_000;
const QUERY_BATCH = 1000;
const SCALAR_TYPES = [
  'string',
  'text',
  'uid',
  'integer',
  'bigInt',
  'float',
  'double',
  'real',
  'decimal',
  'sort',
  'boolean',
  'radio',
  'date',
  'datetimeTz',
  'datetimeNoTz',
  'dateOnly',
  'unixTimestamp',
  'select',
  'checkbox',
  'array',
  'set',
  'multipleSelect',
  'json',
  'jsonb',
  'email',
  'phone',
  'url',
  'password',
  'percent',
  'uuid',
  'nanoid',
  'snowflakeId',
];

interface ColumnDef {
  meta: FieldMeta;
  header: string;
  dateFormat?: string;
  relationFormat?: RelationFormat;
}

interface TableExportResult {
  files: string[];
  totalRows: number;
  previewRows: unknown[][];
  warnings: string[];
}

interface CollectedRelationData {
  referenced: Map<string, Set<unknown>>;
  throughPairs: Map<string, Array<[unknown, unknown]>>;
  attachments: Map<string, Map<unknown, Record<string, unknown>>>;
}

function ts(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(
    d.getSeconds(),
  )}`;
}

function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Sheet1';
}

function cleanTitle(title: unknown, fallback: string): string {
  const text = String(title || '');
  const match = text.match(/^\{\{t\("(.+?)"\)\}\}$/);
  if (match) return match[1];
  return text || fallback;
}

async function packTarGz(
  entries: Array<{ name: string; filePath?: string; buffer?: Buffer }>,
  outPath: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const pack = tar.pack();
    const gzip = zlib.createGzip();
    const out = fs.createWriteStream(outPath);
    pack.pipe(gzip).pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    pack.on('error', reject);
    (async () => {
      for (const entry of entries) {
        if (entry.buffer) {
          pack.entry({ name: entry.name, size: entry.buffer.length }, entry.buffer);
        } else if (entry.filePath) {
          const stat = await fsp.stat(entry.filePath);
          await new Promise<void>((_resolve, _reject) => {
            const source = fs.createReadStream(entry.filePath!);
            source.on('error', _reject);
            const entryStream = pack.entry({ name: entry.name, size: stat.size }, (err) => {
              if (err) _reject(err);
              else _resolve();
            });
            source.pipe(entryStream);
          });
        }
      }
      pack.finalize();
    })().catch(reject);
  });
}

export class ExportEngine {
  constructor(private plugin: Plugin) {}

  private get db() {
    return this.plugin.db;
  }

  private getPkName(collectionName: string): string {
    const collection = this.db.getCollection(collectionName);
    if (!collection) throw new Error(`数据表 ${collectionName} 不存在`);
    const targetKey = collection.options.filterTargetKey;
    // 处理 filterTargetKey 为数组（复合主键）的情况，取第一个字段作为游标
    const key = Array.isArray(targetKey) ? targetKey[0] : targetKey;
    return (key as string) || collection.model.primaryKeyAttribute || 'id';
  }

  private buildColumns(collectionName: string, params: ExportTaskParams): ColumnDef[] {
    const configs: ExportFieldConfig[] = params.allTables
      ? listExportableFields(this.db, collectionName).map((m) => ({ field: m.name }))
      : params.fields || [];
    const columns: ColumnDef[] = [];
    for (const config of configs) {
      const meta = buildFieldMeta(this.db, collectionName, config.field);
      if (!meta || meta.ignored) continue;
      const header =
        params.headerType === 'name'
          ? meta.name
          : params.headerType === 'title'
            ? meta.title
            : `${meta.title}(${meta.name})`;
      columns.push({
        meta,
        header,
        dateFormat: config.dateFormat || params.globalDateFormat || 'YYYY-MM-DD HH:mm:ss',
        relationFormat: config.relationFormat || params.globalRelationFormat || 'display',
      });
    }
    return columns;
  }

  private formatScalar(meta: FieldMeta, value: unknown, column: ColumnDef): unknown {
    if (value === null || value === undefined) return null;
    const effectiveType =
      meta.interface === 'select' || meta.type === 'select'
        ? 'select'
        : meta.interface === 'multipleSelect'
          ? 'multipleSelect'
          : meta.type;
    if (['date', 'datetimeTz', 'datetimeNoTz', 'dateOnly', 'unixTimestamp'].includes(effectiveType)) {
      return formatDateValue(value, column.dateFormat!);
    }
    if (effectiveType === 'boolean' || effectiveType === 'radio') return formatBooleanValue(value);
    if (effectiveType === 'select') return formatSelectValue(value, meta.options);
    if (['multipleSelect', 'checkbox', 'array', 'set'].includes(effectiveType) && meta.options?.length) {
      return formatMultiSelectValue(value, meta.options);
    }
    if (effectiveType === 'json' || effectiveType === 'jsonb') return JSON.stringify(value);
    return value;
  }

  private async resolveRelations(
    collectionName: string,
    batch: Array<Record<string, unknown>>,
    columns: ColumnDef[],
    pkName: string,
    collected: CollectedRelationData,
    recordCache: Map<string, Map<unknown, Record<string, unknown>>>,
  ): Promise<Map<string, Map<unknown, unknown[]>>> {
    const resolved = new Map<string, Map<unknown, unknown[]>>();
    const batchPks = batch.map((r) => r[pkName]);
    for (const column of columns) {
      const meta = column.meta;
      const isRelation = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(meta.type);
      if (!isRelation || !meta.target) continue;
      const targetPk = meta.targetKey || this.getPkName(meta.target);
      const titleField = meta.attachment ? 'title' : getTitleField(this.db.getCollection(meta.target)!, targetPk);
      const perRow = new Map<unknown, unknown[]>();

      const loadRecords = async (ids: unknown[]): Promise<Map<unknown, Record<string, unknown>>> => {
        let cache = recordCache.get(meta.target!);
        if (!cache) {
          cache = new Map();
          recordCache.set(meta.target!, cache);
        }
        const missing = ids.filter((id) => id !== null && id !== undefined && !cache!.has(id));
        const wantedFields = meta.attachment
          ? [...new Set([targetPk, titleField, 'filename', 'extname', 'path'])]
          : [...new Set([targetPk, titleField])];
        for (let i = 0; i < missing.length; i += 1000) {
          const chunk = missing.slice(i, i + 1000);
          const records = await this.db.getRepository(meta.target!).find({
            filter: { [targetPk]: { $in: chunk } },
            fields: wantedFields,
          });
          for (const record of records) {
            cache!.set(record.get(targetPk), record.toJSON() as Record<string, unknown>);
          }
        }
        return cache;
      };

      if (meta.type === 'belongsTo' || meta.type === 'hasOne') {
        const fkName = meta.foreignKey || `${meta.name}Id`;
        const fkValues = batch.map((r) => r[fkName]).filter((v) => v !== null && v !== undefined);
        const records = await loadRecords([...new Set(fkValues)]);
        for (const row of batch) {
          const fk = row[fkName];
          perRow.set(row[pkName], fk === null || fk === undefined ? [] : [records.get(fk)].filter(Boolean));
        }
        if (!collected.referenced.has(meta.name)) collected.referenced.set(meta.name, new Set());
        for (const v of fkValues) collected.referenced.get(meta.name)!.add(v);
      } else {
        let pairs: Array<Record<string, unknown>> = [];
        if (meta.type === 'belongsToMany' && meta.through) {
          const fk = meta.foreignKey || `${meta.name}Id`;
          const ok = meta.otherKey || `${targetPk}`;
          pairs = await this.db
            .getRepository(meta.through)
            .find({
              filter: { [fk]: { $in: batchPks } },
              fields: [fk, ok],
            })
            .then((list) => list.map((m) => ({ src: m.get(fk), tgt: m.get(ok) })));
        } else if (meta.type === 'hasMany' && meta.foreignKey) {
          const targets = await this.db.getRepository(meta.target).find({
            filter: { [meta.foreignKey]: { $in: batchPks } },
            fields: [targetPk, meta.foreignKey],
          });
          pairs = targets.map((m) => ({ src: m.get(meta.foreignKey!), tgt: m.get(targetPk) }));
        }
        const tgtIds = [...new Set(pairs.map((p) => p.tgt))];
        const records = await loadRecords(tgtIds);
        for (const p of pairs) {
          if (!perRow.has(p.src)) perRow.set(p.src, []);
          const record = records.get(p.tgt);
          if (record) perRow.get(p.src)!.push(record);
          if (!collected.throughPairs.has(meta.name)) collected.throughPairs.set(meta.name, []);
          collected.throughPairs.get(meta.name)!.push([p.src, p.tgt]);
          if (meta.attachment) {
            if (!collected.attachments.has(meta.name)) collected.attachments.set(meta.name, new Map());
            collected.attachments.get(meta.name)!.set(p.tgt, record);
          }
        }
      }
      resolved.set(meta.name, perRow);
    }
    return resolved;
  }

  private formatRelationCell(column: ColumnDef, records: unknown[]): string | null {
    const meta = column.meta;
    if (!records.length) return null;
    const targetPk = meta.targetKey || this.getPkName(meta.target!);
    const titleField = meta.attachment ? 'title' : getTitleField(this.db.getCollection(meta.target!)!, targetPk);
    const parts = records.map((record) => {
      const r = record as Record<string, unknown>;
      if (meta.attachment) {
        return `${r.title ?? ''}${r.extname ?? ''}`;
      }
      return formatRelationRecord(r, targetPk, titleField, column.relationFormat!);
    });
    return parts.filter(Boolean).join(',') || null;
  }

  private async writeTableWorkbook(
    ctx: TaskHandlerContext,
    params: ExportTaskParams,
    collectionName: string,
    columns: ColumnDef[],
    fileBaseName: string,
    workDir: string,
    collected: CollectedRelationData | null,
  ): Promise<TableExportResult> {
    const repo = this.db.getRepository(collectionName);
    const pkName = this.getPkName(collectionName);
    const baseFilter = this.mergeFilter(params.filter, params.exportFilter);
    const total = Number(await repo.count({ filter: baseFilter })) || 0;
    await ctx.updateProgress(0, total);

    const files: string[] = [];
    const previewRows: unknown[][] = [];
    const warnings: string[] = [];
    const recordCache = new Map<string, Map<unknown, Record<string, unknown>>>();
    let processed = 0;
    let lastPk: unknown = null;
    let part = 1;
    let rowsInPart = 0;

    const openWriter = async () => {
      const filePath = path.join(workDir, part === 1 ? `${fileBaseName}.xlsx` : `${fileBaseName}-part${part}.xlsx`);
      const writer = new Excel.stream.xlsx.WorkbookWriter({ filename: filePath, useStyles: false });
      const sheet = writer.addWorksheet(safeSheetName('数据'));
      sheet.addRow(columns.map((c) => c.header)).commit();
      files.push(filePath);
      return { writer, sheet, filePath };
    };

    let current = await openWriter();
    const relationColumns = columns.filter(
      (c) => ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(c.meta.type) && c.meta.target,
    );

    for (;;) {
      ctx.throwIfAborted();
      const filter = lastPk === null ? baseFilter : this.mergeFilter(baseFilter, { [pkName]: { $gt: lastPk } });
      const models = await repo.find({ filter, sort: [pkName], limit: QUERY_BATCH });
      if (!models.length) break;
      const batch = models.map((m) => m.toJSON() as Record<string, unknown>);
      const resolved = relationColumns.length
        ? await this.resolveRelations(
            collectionName,
            batch,
            relationColumns,
            pkName,
            collected || this.emptyCollected(),
            recordCache,
          )
        : new Map<string, Map<unknown, unknown[]>>();

      for (const row of batch) {
        const line = columns.map((column) => {
          const meta = column.meta;
          if (['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(meta.type) && meta.target) {
            const records = resolved.get(meta.name)?.get(row[pkName]) || [];
            return this.formatRelationCell(column, records);
          }
          return this.formatScalar(meta, row[meta.name], column);
        });
        current.sheet.addRow(line).commit();
        if (previewRows.length < 10) previewRows.push(line);
        processed += 1;
        // 周期性让出事件循环，避免大批量导出阻塞 API 请求
        if (processed % 200 === 0) await yieldEventLoop();
        rowsInPart += 1;
        if (rowsInPart >= ROWS_PER_FILE) {
          await current.writer.commit();
          part += 1;
          rowsInPart = 0;
          current = await openWriter();
        }
        lastPk = row[pkName];
      }
      await ctx.updateProgress(processed, total);
      await ctx.updateStats({ totalRows: total, successRows: processed });
      if (models.length < QUERY_BATCH) break;
    }

    const relationSheets =
      collected && params.relationFields?.length && (params.relationExportMode || 'sheet') === 'sheet';
    if (relationSheets && part === 1) {
      await this.writeRelationSheets(current.writer, params, collectionName, columns, collected!, pkName);
      await current.writer.commit();
    } else {
      await current.writer.commit();
      if (relationSheets) {
        const relPath = path.join(workDir, `${fileBaseName}-关联表.xlsx`);
        const relWriter = new Excel.stream.xlsx.WorkbookWriter({ filename: relPath, useStyles: false });
        await this.writeRelationSheets(relWriter, params, collectionName, columns, collected!, pkName);
        await relWriter.commit();
        files.push(relPath);
      }
    }

    if (collected && params.relationFields?.length && params.relationExportMode === 'file') {
      const relFiles = await this.writeRelationFiles(params, collectionName, columns, collected, pkName, workDir);
      files.push(...relFiles);
    }

    return { files, totalRows: processed, previewRows, warnings };
  }

  private emptyCollected(): CollectedRelationData {
    return { referenced: new Map(), throughPairs: new Map(), attachments: new Map() };
  }

  private async writeRelationSheets(
    writer: Excel.stream.xlsx.WorkbookWriter,
    params: ExportTaskParams,
    collectionName: string,
    columns: ColumnDef[],
    collected: CollectedRelationData,
    pkName: string,
  ): Promise<void> {
    for (const fieldName of params.relationFields || []) {
      const column = columns.find((c) => c.meta.name === fieldName);
      if (!column?.meta.target) continue;
      const meta = column.meta;
      const targetCollection = this.db.getCollection(meta.target)!;
      const targetPk = meta.targetKey || this.getPkName(meta.target);
      const sheetLabel = `${meta.title}(${meta.name})-${cleanTitle(targetCollection.options.title, meta.target)}(${
        meta.target
      })`;
      const sheet = writer.addWorksheet(safeSheetName(sheetLabel));
      if (meta.type === 'belongsToMany' || meta.type === 'hasMany') {
        const titleField = getTitleField(targetCollection, targetPk);
        sheet.addRow([`${collectionName}.${pkName}`, `${meta.target}.${targetPk}`, titleField]).commit();
        const pairs = collected.throughPairs.get(meta.name) || [];
        const titleFieldCache = new Map<unknown, unknown>();
        let pairCount = 0;
        for (const [src, tgt] of pairs) {
          pairCount += 1;
          if (pairCount % 500 === 0) await yieldEventLoop();
          if (!titleFieldCache.has(tgt)) {
            const record = await this.db
              .getRepository(meta.target)
              .findOne({ filter: { [targetPk]: tgt }, fields: [targetPk, titleField] });
            titleFieldCache.set(tgt, record ? record.get(titleField) : null);
          }
          sheet.addRow([src, tgt, titleFieldCache.get(tgt)]).commit();
        }
      } else {
        const targetColumns = listExportableFields(this.db, meta.target).filter(
          (m) => SCALAR_TYPES.includes(m.type) || m.interface === 'select',
        );
        sheet.addRow(targetColumns.map((m) => m.title)).commit();
        const ids = [...(collected.referenced.get(meta.name) || new Set())];
        for (let i = 0; i < ids.length; i += 1000) {
          const records = await this.db
            .getRepository(meta.target)
            .find({ filter: { [targetPk]: { $in: ids.slice(i, i + 1000) } } });
          let recordCount = 0;
          for (const record of records) {
            recordCount += 1;
            if (recordCount % 500 === 0) await yieldEventLoop();
            const json = record.toJSON() as Record<string, unknown>;
            sheet
              .addRow(
                targetColumns.map((m) =>
                  this.formatScalar(m, json[m.name], {
                    meta: m,
                    header: m.title,
                    dateFormat: params.globalDateFormat || 'YYYY-MM-DD HH:mm:ss',
                  }),
                ),
              )
              .commit();
          }
        }
      }
    }
  }

  private async writeRelationFiles(
    params: ExportTaskParams,
    collectionName: string,
    columns: ColumnDef[],
    collected: CollectedRelationData,
    pkName: string,
    workDir: string,
  ): Promise<string[]> {
    const files: string[] = [];
    for (const fieldName of params.relationFields || []) {
      const column = columns.find((c) => c.meta.name === fieldName);
      if (!column?.meta.target) continue;
      const meta = column.meta;
      const filePath = path.join(
        workDir,
        `${meta.title}(${meta.name})-${meta.target}.xlsx`.replace(/[\\/?*[\]:]/g, '_'),
      );
      const writer = new Excel.stream.xlsx.WorkbookWriter({ filename: filePath, useStyles: false });
      await this.writeRelationSheets(
        writer,
        { ...params, relationFields: [fieldName] },
        collectionName,
        columns,
        collected,
        pkName,
      );
      await writer.commit();
      files.push(filePath);
    }
    return files;
  }

  private mergeFilter(a: unknown, b: unknown): Record<string, unknown> {
    const parts = [a, b].filter((f) => f && typeof f === 'object' && Object.keys(f as object).length);
    if (!parts.length) return {};
    if (parts.length === 1) return parts[0] as Record<string, unknown>;
    return { $and: parts };
  }

  private async collectAttachmentFiles(
    collected: CollectedRelationData,
  ): Promise<Array<{ name: string; filePath: string }>> {
    const entries: Array<{ name: string; filePath: string }> = [];
    const usedNames = new Set<string>();
    let processed = 0;
    for (const [fieldName, records] of collected.attachments) {
      for (const [id, record] of records) {
        processed += 1;
        if (processed % 100 === 0) await yieldEventLoop();
        const storagePath = String(record.path || '');
        const filename = String(record.filename || '');
        if (!filename) continue;
        const sourcePath = storagePathJoin(path.join('uploads', storagePath, filename));
        try {
          await fsp.access(sourcePath);
        } catch {
          continue;
        }
        let displayName = `${record.title ?? ''}${record.extname ?? ''}`;
        if (usedNames.has(`${fieldName}/${displayName}`)) {
          displayName = `${id}-${displayName}`;
        }
        usedNames.add(`${fieldName}/${displayName}`);
        entries.push({ name: `attachments/${fieldName}/${displayName}`, filePath: sourcePath });
      }
    }
    return entries;
  }

  async run(ctx: TaskHandlerContext, params: ExportTaskParams): Promise<Record<string, unknown>> {
    const workDir = storagePathJoin(path.join('sjgl02', 'exports', `task-${ctx.taskId}`));
    await fsp.mkdir(workDir, { recursive: true });
    const timestamp = ts();

    if (params.allTables) {
      return this.runAllTables(ctx, params, workDir, timestamp);
    }

    const collection = this.db.getCollection(params.collectionName);
    const collectionTitle = cleanTitle(collection?.options.title, params.collectionName);
    const columns = this.buildColumns(params.collectionName, params);
    if (!columns.length) throw new Error('未选择任何可导出字段');

    const collected = this.emptyCollected();
    const fileBaseName = `${collectionTitle}-${params.collectionName}-${timestamp}`.replace(/[\\/?*[\]:]/g, '_');
    const result = await this.writeTableWorkbook(
      ctx,
      params,
      params.collectionName,
      columns,
      fileBaseName,
      workDir,
      collected,
    );

    const attachmentEntries = params.exportAttachment ? await this.collectAttachmentFiles(collected) : [];
    let finalPath: string;
    let finalName: string;
    if (result.files.length === 1 && !attachmentEntries.length) {
      finalPath = result.files[0];
      finalName = path.basename(finalPath);
    } else {
      finalName = `${fileBaseName}.tar.gz`;
      finalPath = path.join(workDir, finalName);
      const entries = [...result.files.map((f) => ({ name: path.basename(f), filePath: f })), ...attachmentEntries];
      await packTarGz(entries, finalPath);
    }
    const stat = await fsp.stat(finalPath);
    await this.db.getRepository('sjgl02Tasks').update({
      filter: { id: ctx.taskId },
      values: { filePath: finalPath, fileName: finalName, fileSize: stat.size },
    });
    return {
      totalRows: result.totalRows,
      successRows: result.totalRows,
      errorRows: 0,
      previewRows: result.previewRows,
      headers: columns.map((c) => c.header),
      files: [finalName],
      attachmentsPacked: attachmentEntries.length,
      warnings: result.warnings,
    };
  }

  private async runAllTables(
    ctx: TaskHandlerContext,
    params: ExportTaskParams,
    workDir: string,
    timestamp: string,
  ): Promise<Record<string, unknown>> {
    const collections = [...this.db.collections.values()].filter((c) => {
      const opts = c.options as Record<string, unknown>;
      return !opts.view && c.model?.tableName;
    });
    const files: string[] = [];
    const tableSummaries: Array<{ name: string; title: string; rows: number }> = [];
    const warnings: string[] = [];
    let totalRows = 0;
    const collected = this.emptyCollected();

    for (const collection of collections) {
      ctx.throwIfAborted();
      try {
        const columns = this.buildColumns(collection.name, { ...params, allTables: true });
        if (!columns.length) continue;
        const title = cleanTitle(collection.options.title, collection.name);
        const fileBaseName = `${title}-${collection.name}`.replace(/[\\/?*[\]:]/g, '_');
        const result = await this.writeTableWorkbook(
          ctx,
          { ...params, filter: null, exportFilter: null, relationFields: [] },
          collection.name,
          columns,
          fileBaseName,
          workDir,
          collected,
        );
        files.push(...result.files);
        tableSummaries.push({ name: collection.name, title, rows: result.totalRows });
        totalRows += result.totalRows;
      } catch (error) {
        warnings.push(`表 ${collection.name} 导出失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const attachmentEntries = params.exportAttachment ? await this.collectAttachmentFiles(collected) : [];
    const finalName = `全部数据表-${timestamp}.tar.gz`;
    const finalPath = path.join(workDir, finalName);
    await packTarGz(
      [
        {
          name: '导出清单.json',
          buffer: Buffer.from(
            JSON.stringify({ tables: tableSummaries, totalRows, exportedAt: new Date().toISOString() }, null, 2),
          ),
        },
        ...files.map((f) => ({ name: path.basename(f), filePath: f })),
        ...attachmentEntries,
      ],
      finalPath,
    );
    const stat = await fsp.stat(finalPath);
    await this.db.getRepository('sjgl02Tasks').update({
      filter: { id: ctx.taskId },
      values: { filePath: finalPath, fileName: finalName, fileSize: stat.size },
    });
    return {
      totalRows,
      successRows: totalRows,
      errorRows: 0,
      tables: tableSummaries,
      files: [finalName],
      attachmentsPacked: attachmentEntries.length,
      warnings,
    };
  }
}
