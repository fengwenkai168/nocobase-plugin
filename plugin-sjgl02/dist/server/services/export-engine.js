/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var export_engine_exports = {};
__export(export_engine_exports, {
  ExportEngine: () => ExportEngine
});
module.exports = __toCommonJS(export_engine_exports);
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = __toESM(require("node:path"));
var import_node_zlib = __toESM(require("node:zlib"));
var import_exceljs = __toESM(require("exceljs"));
var tar = __toESM(require("tar-stream"));
var import_utils = require("@nocobase/utils");
var import_field_meta = require("./field-meta");
var import_excel_parser = require("./excel-parser");
var import_export_format = require("./export-format");
const ROWS_PER_FILE = 1e6;
const QUERY_BATCH = 1e3;
const SCALAR_TYPES = [
  "string",
  "text",
  "uid",
  "integer",
  "bigInt",
  "float",
  "double",
  "real",
  "decimal",
  "sort",
  "boolean",
  "radio",
  "date",
  "datetimeTz",
  "datetimeNoTz",
  "dateOnly",
  "unixTimestamp",
  "select",
  "checkbox",
  "array",
  "set",
  "multipleSelect",
  "json",
  "jsonb",
  "email",
  "phone",
  "url",
  "password",
  "percent",
  "uuid",
  "nanoid",
  "snowflakeId"
];
function ts() {
  const d = /* @__PURE__ */ new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(
    d.getSeconds()
  )}`;
}
function safeSheetName(name) {
  return name.replace(/[\\/?*[\]:]/g, "_").slice(0, 31) || "Sheet1";
}
function cleanTitle(title, fallback) {
  const text = String(title || "");
  const match = text.match(/^\{\{t\("(.+?)"\)\}\}$/);
  if (match) return match[1];
  return text || fallback;
}
async function packTarGz(entries, outPath) {
  await new Promise((resolve, reject) => {
    const pack = tar.pack();
    const gzip = import_node_zlib.default.createGzip();
    const out = import_node_fs.default.createWriteStream(outPath);
    pack.pipe(gzip).pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
    pack.on("error", reject);
    (async () => {
      for (const entry of entries) {
        if (entry.buffer) {
          pack.entry({ name: entry.name, size: entry.buffer.length }, entry.buffer);
        } else if (entry.filePath) {
          const stat = await import_promises.default.stat(entry.filePath);
          await new Promise((_resolve, _reject) => {
            const source = import_node_fs.default.createReadStream(entry.filePath);
            source.on("error", _reject);
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
class ExportEngine {
  constructor(plugin) {
    this.plugin = plugin;
  }
  get db() {
    return this.plugin.db;
  }
  getPkName(collectionName) {
    const collection = this.db.getCollection(collectionName);
    if (!collection) throw new Error(`\u6570\u636E\u8868 ${collectionName} \u4E0D\u5B58\u5728`);
    return collection.options.filterTargetKey || collection.model.primaryKeyAttribute || "id";
  }
  buildColumns(collectionName, params) {
    const configs = params.allTables ? (0, import_field_meta.listExportableFields)(this.db, collectionName).map((m) => ({ field: m.name })) : params.fields || [];
    const columns = [];
    for (const config of configs) {
      const meta = (0, import_field_meta.buildFieldMeta)(this.db, collectionName, config.field);
      if (!meta || meta.ignored) continue;
      const header = params.headerType === "name" ? meta.name : params.headerType === "title" ? meta.title : `${meta.title}(${meta.name})`;
      columns.push({
        meta,
        header,
        dateFormat: config.dateFormat || params.globalDateFormat || "YYYY-MM-DD HH:mm:ss",
        relationFormat: config.relationFormat || params.globalRelationFormat || "display"
      });
    }
    return columns;
  }
  formatScalar(meta, value, column) {
    var _a;
    if (value === null || value === void 0) return null;
    const effectiveType = meta.interface === "select" || meta.type === "select" ? "select" : meta.interface === "multipleSelect" ? "multipleSelect" : meta.type;
    if (["date", "datetimeTz", "datetimeNoTz", "dateOnly", "unixTimestamp"].includes(effectiveType)) {
      return (0, import_export_format.formatDateValue)(value, column.dateFormat);
    }
    if (effectiveType === "boolean" || effectiveType === "radio") return (0, import_export_format.formatBooleanValue)(value);
    if (effectiveType === "select") return (0, import_export_format.formatSelectValue)(value, meta.options);
    if (["multipleSelect", "checkbox", "array", "set"].includes(effectiveType) && ((_a = meta.options) == null ? void 0 : _a.length)) {
      return (0, import_export_format.formatMultiSelectValue)(value, meta.options);
    }
    if (effectiveType === "json" || effectiveType === "jsonb") return JSON.stringify(value);
    return value;
  }
  async resolveRelations(collectionName, batch, columns, pkName, collected, recordCache) {
    const resolved = /* @__PURE__ */ new Map();
    const batchPks = batch.map((r) => r[pkName]);
    for (const column of columns) {
      const meta = column.meta;
      const isRelation = ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(meta.type);
      if (!isRelation || !meta.target) continue;
      const targetPk = meta.targetKey || this.getPkName(meta.target);
      const titleField = meta.attachment ? "title" : (0, import_export_format.getTitleField)(this.db.getCollection(meta.target), targetPk);
      const perRow = /* @__PURE__ */ new Map();
      const loadRecords = async (ids) => {
        let cache = recordCache.get(meta.target);
        if (!cache) {
          cache = /* @__PURE__ */ new Map();
          recordCache.set(meta.target, cache);
        }
        const missing = ids.filter((id) => id !== null && id !== void 0 && !cache.has(id));
        const wantedFields = meta.attachment ? [.../* @__PURE__ */ new Set([targetPk, titleField, "filename", "extname", "path"])] : [.../* @__PURE__ */ new Set([targetPk, titleField])];
        for (let i = 0; i < missing.length; i += 1e3) {
          const chunk = missing.slice(i, i + 1e3);
          const records = await this.db.getRepository(meta.target).find({
            filter: { [targetPk]: { $in: chunk } },
            fields: wantedFields
          });
          for (const record of records) {
            cache.set(record.get(targetPk), record.toJSON());
          }
        }
        return cache;
      };
      if (meta.type === "belongsTo" || meta.type === "hasOne") {
        const fkName = meta.foreignKey || `${meta.name}Id`;
        const fkValues = batch.map((r) => r[fkName]).filter((v) => v !== null && v !== void 0);
        const records = await loadRecords([...new Set(fkValues)]);
        for (const row of batch) {
          const fk = row[fkName];
          perRow.set(row[pkName], fk === null || fk === void 0 ? [] : [records.get(fk)].filter(Boolean));
        }
        if (!collected.referenced.has(meta.name)) collected.referenced.set(meta.name, /* @__PURE__ */ new Set());
        for (const v of fkValues) collected.referenced.get(meta.name).add(v);
      } else {
        let pairs = [];
        if (meta.type === "belongsToMany" && meta.through) {
          const fk = meta.foreignKey || `${meta.name}Id`;
          const ok = meta.otherKey || `${targetPk}`;
          pairs = await this.db.getRepository(meta.through).find({
            filter: { [fk]: { $in: batchPks } },
            fields: [fk, ok]
          }).then((list) => list.map((m) => ({ src: m.get(fk), tgt: m.get(ok) })));
        } else if (meta.type === "hasMany" && meta.foreignKey) {
          const targets = await this.db.getRepository(meta.target).find({
            filter: { [meta.foreignKey]: { $in: batchPks } },
            fields: [targetPk, meta.foreignKey]
          });
          pairs = targets.map((m) => ({ src: m.get(meta.foreignKey), tgt: m.get(targetPk) }));
        }
        const tgtIds = [...new Set(pairs.map((p) => p.tgt))];
        const records = await loadRecords(tgtIds);
        for (const p of pairs) {
          if (!perRow.has(p.src)) perRow.set(p.src, []);
          const record = records.get(p.tgt);
          if (record) perRow.get(p.src).push(record);
          if (!collected.throughPairs.has(meta.name)) collected.throughPairs.set(meta.name, []);
          collected.throughPairs.get(meta.name).push([p.src, p.tgt]);
          if (meta.attachment) {
            if (!collected.attachments.has(meta.name)) collected.attachments.set(meta.name, /* @__PURE__ */ new Map());
            collected.attachments.get(meta.name).set(p.tgt, record);
          }
        }
      }
      resolved.set(meta.name, perRow);
    }
    return resolved;
  }
  formatRelationCell(column, records) {
    const meta = column.meta;
    if (!records.length) return null;
    const targetPk = meta.targetKey || this.getPkName(meta.target);
    const titleField = meta.attachment ? "title" : (0, import_export_format.getTitleField)(this.db.getCollection(meta.target), targetPk);
    const parts = records.map((record) => {
      const r = record;
      if (meta.attachment) {
        return `${r.title ?? ""}${r.extname ?? ""}`;
      }
      return (0, import_export_format.formatRelationRecord)(r, targetPk, titleField, column.relationFormat);
    });
    return parts.filter(Boolean).join(",") || null;
  }
  async writeTableWorkbook(ctx, params, collectionName, columns, fileBaseName, workDir, collected) {
    var _a, _b;
    const repo = this.db.getRepository(collectionName);
    const pkName = this.getPkName(collectionName);
    const baseFilter = this.mergeFilter(params.filter, params.exportFilter);
    const total = Number(await repo.count({ filter: baseFilter })) || 0;
    await ctx.updateProgress(0, total);
    const files = [];
    const previewRows = [];
    const warnings = [];
    const recordCache = /* @__PURE__ */ new Map();
    let processed = 0;
    let lastPk = null;
    let part = 1;
    let rowsInPart = 0;
    const openWriter = async () => {
      const filePath = import_node_path.default.join(workDir, part === 1 ? `${fileBaseName}.xlsx` : `${fileBaseName}-part${part}.xlsx`);
      const writer = new import_exceljs.default.stream.xlsx.WorkbookWriter({ filename: filePath, useStyles: false });
      const sheet = writer.addWorksheet(safeSheetName("\u6570\u636E"));
      sheet.addRow(columns.map((c) => c.header)).commit();
      files.push(filePath);
      return { writer, sheet, filePath };
    };
    let current = await openWriter();
    const relationColumns = columns.filter(
      (c) => ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(c.meta.type) && c.meta.target
    );
    for (; ; ) {
      ctx.throwIfAborted();
      const filter = lastPk === null ? baseFilter : this.mergeFilter(baseFilter, { [pkName]: { $gt: lastPk } });
      const models = await repo.find({ filter, sort: [pkName], limit: QUERY_BATCH });
      if (!models.length) break;
      const batch = models.map((m) => m.toJSON());
      const resolved = relationColumns.length ? await this.resolveRelations(
        collectionName,
        batch,
        relationColumns,
        pkName,
        collected || this.emptyCollected(),
        recordCache
      ) : /* @__PURE__ */ new Map();
      for (const row of batch) {
        const line = columns.map((column) => {
          var _a2;
          const meta = column.meta;
          if (["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(meta.type) && meta.target) {
            const records = ((_a2 = resolved.get(meta.name)) == null ? void 0 : _a2.get(row[pkName])) || [];
            return this.formatRelationCell(column, records);
          }
          return this.formatScalar(meta, row[meta.name], column);
        });
        current.sheet.addRow(line).commit();
        if (previewRows.length < 10) previewRows.push(line);
        processed += 1;
        if (processed % 200 === 0) await (0, import_excel_parser.yieldEventLoop)();
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
    const relationSheets = collected && ((_a = params.relationFields) == null ? void 0 : _a.length) && (params.relationExportMode || "sheet") === "sheet";
    if (relationSheets && part === 1) {
      await this.writeRelationSheets(current.writer, params, collectionName, columns, collected, pkName);
      await current.writer.commit();
    } else {
      await current.writer.commit();
      if (relationSheets) {
        const relPath = import_node_path.default.join(workDir, `${fileBaseName}-\u5173\u8054\u8868.xlsx`);
        const relWriter = new import_exceljs.default.stream.xlsx.WorkbookWriter({ filename: relPath, useStyles: false });
        await this.writeRelationSheets(relWriter, params, collectionName, columns, collected, pkName);
        await relWriter.commit();
        files.push(relPath);
      }
    }
    if (collected && ((_b = params.relationFields) == null ? void 0 : _b.length) && params.relationExportMode === "file") {
      const relFiles = await this.writeRelationFiles(params, collectionName, columns, collected, pkName, workDir);
      files.push(...relFiles);
    }
    return { files, totalRows: processed, previewRows, warnings };
  }
  emptyCollected() {
    return { referenced: /* @__PURE__ */ new Map(), throughPairs: /* @__PURE__ */ new Map(), attachments: /* @__PURE__ */ new Map() };
  }
  async writeRelationSheets(writer, params, collectionName, columns, collected, pkName) {
    for (const fieldName of params.relationFields || []) {
      const column = columns.find((c) => c.meta.name === fieldName);
      if (!(column == null ? void 0 : column.meta.target)) continue;
      const meta = column.meta;
      const targetCollection = this.db.getCollection(meta.target);
      const targetPk = meta.targetKey || this.getPkName(meta.target);
      const sheetLabel = `${meta.title}(${meta.name})-${cleanTitle(targetCollection.options.title, meta.target)}(${meta.target})`;
      const sheet = writer.addWorksheet(safeSheetName(sheetLabel));
      if (meta.type === "belongsToMany" || meta.type === "hasMany") {
        const titleField = (0, import_export_format.getTitleField)(targetCollection, targetPk);
        sheet.addRow([`${collectionName}.${pkName}`, `${meta.target}.${targetPk}`, titleField]).commit();
        const pairs = collected.throughPairs.get(meta.name) || [];
        const titleFieldCache = /* @__PURE__ */ new Map();
        let pairCount = 0;
        for (const [src, tgt] of pairs) {
          pairCount += 1;
          if (pairCount % 500 === 0) await (0, import_excel_parser.yieldEventLoop)();
          if (!titleFieldCache.has(tgt)) {
            const record = await this.db.getRepository(meta.target).findOne({ filter: { [targetPk]: tgt }, fields: [targetPk, titleField] });
            titleFieldCache.set(tgt, record ? record.get(titleField) : null);
          }
          sheet.addRow([src, tgt, titleFieldCache.get(tgt)]).commit();
        }
      } else {
        const targetColumns = (0, import_field_meta.listExportableFields)(this.db, meta.target).filter(
          (m) => SCALAR_TYPES.includes(m.type) || m.interface === "select"
        );
        sheet.addRow(targetColumns.map((m) => m.title)).commit();
        const ids = [...collected.referenced.get(meta.name) || /* @__PURE__ */ new Set()];
        for (let i = 0; i < ids.length; i += 1e3) {
          const records = await this.db.getRepository(meta.target).find({ filter: { [targetPk]: { $in: ids.slice(i, i + 1e3) } } });
          let recordCount = 0;
          for (const record of records) {
            recordCount += 1;
            if (recordCount % 500 === 0) await (0, import_excel_parser.yieldEventLoop)();
            const json = record.toJSON();
            sheet.addRow(
              targetColumns.map(
                (m) => this.formatScalar(m, json[m.name], {
                  meta: m,
                  header: m.title,
                  dateFormat: params.globalDateFormat || "YYYY-MM-DD HH:mm:ss"
                })
              )
            ).commit();
          }
        }
      }
    }
  }
  async writeRelationFiles(params, collectionName, columns, collected, pkName, workDir) {
    const files = [];
    for (const fieldName of params.relationFields || []) {
      const column = columns.find((c) => c.meta.name === fieldName);
      if (!(column == null ? void 0 : column.meta.target)) continue;
      const meta = column.meta;
      const filePath = import_node_path.default.join(
        workDir,
        `${meta.title}(${meta.name})-${meta.target}.xlsx`.replace(/[\\/?*[\]:]/g, "_")
      );
      const writer = new import_exceljs.default.stream.xlsx.WorkbookWriter({ filename: filePath, useStyles: false });
      await this.writeRelationSheets(
        writer,
        { ...params, relationFields: [fieldName] },
        collectionName,
        columns,
        collected,
        pkName
      );
      await writer.commit();
      files.push(filePath);
    }
    return files;
  }
  mergeFilter(a, b) {
    const parts = [a, b].filter((f) => f && typeof f === "object" && Object.keys(f).length);
    if (!parts.length) return {};
    if (parts.length === 1) return parts[0];
    return { $and: parts };
  }
  async collectAttachmentFiles(collected) {
    const entries = [];
    const usedNames = /* @__PURE__ */ new Set();
    let processed = 0;
    for (const [fieldName, records] of collected.attachments) {
      for (const [id, record] of records) {
        processed += 1;
        if (processed % 100 === 0) await (0, import_excel_parser.yieldEventLoop)();
        const storagePath = String(record.path || "");
        const filename = String(record.filename || "");
        if (!filename) continue;
        const sourcePath = (0, import_utils.storagePathJoin)(import_node_path.default.join("uploads", storagePath, filename));
        try {
          await import_promises.default.access(sourcePath);
        } catch {
          continue;
        }
        let displayName = `${record.title ?? ""}${record.extname ?? ""}`;
        if (usedNames.has(`${fieldName}/${displayName}`)) {
          displayName = `${id}-${displayName}`;
        }
        usedNames.add(`${fieldName}/${displayName}`);
        entries.push({ name: `attachments/${fieldName}/${displayName}`, filePath: sourcePath });
      }
    }
    return entries;
  }
  async run(ctx, params) {
    const workDir = (0, import_utils.storagePathJoin)(import_node_path.default.join("sjgl02", "exports", `task-${ctx.taskId}`));
    await import_promises.default.mkdir(workDir, { recursive: true });
    const timestamp = ts();
    if (params.allTables) {
      return this.runAllTables(ctx, params, workDir, timestamp);
    }
    const collection = this.db.getCollection(params.collectionName);
    const collectionTitle = cleanTitle(collection == null ? void 0 : collection.options.title, params.collectionName);
    const columns = this.buildColumns(params.collectionName, params);
    if (!columns.length) throw new Error("\u672A\u9009\u62E9\u4EFB\u4F55\u53EF\u5BFC\u51FA\u5B57\u6BB5");
    const collected = this.emptyCollected();
    const fileBaseName = `${collectionTitle}-${params.collectionName}-${timestamp}`.replace(/[\\/?*[\]:]/g, "_");
    const result = await this.writeTableWorkbook(
      ctx,
      params,
      params.collectionName,
      columns,
      fileBaseName,
      workDir,
      collected
    );
    const attachmentEntries = params.exportAttachment ? await this.collectAttachmentFiles(collected) : [];
    let finalPath;
    let finalName;
    if (result.files.length === 1 && !attachmentEntries.length) {
      finalPath = result.files[0];
      finalName = import_node_path.default.basename(finalPath);
    } else {
      finalName = `${fileBaseName}.tar.gz`;
      finalPath = import_node_path.default.join(workDir, finalName);
      const entries = [...result.files.map((f) => ({ name: import_node_path.default.basename(f), filePath: f })), ...attachmentEntries];
      await packTarGz(entries, finalPath);
    }
    const stat = await import_promises.default.stat(finalPath);
    await this.db.getRepository("sjgl02Tasks").update({
      filter: { id: ctx.taskId },
      values: { filePath: finalPath, fileName: finalName, fileSize: stat.size }
    });
    return {
      totalRows: result.totalRows,
      successRows: result.totalRows,
      errorRows: 0,
      previewRows: result.previewRows,
      headers: columns.map((c) => c.header),
      files: [finalName],
      attachmentsPacked: attachmentEntries.length,
      warnings: result.warnings
    };
  }
  async runAllTables(ctx, params, workDir, timestamp) {
    const collections = [...this.db.collections.values()].filter((c) => {
      var _a;
      const opts = c.options;
      return !opts.view && ((_a = c.model) == null ? void 0 : _a.tableName);
    });
    const files = [];
    const tableSummaries = [];
    const warnings = [];
    let totalRows = 0;
    const collected = this.emptyCollected();
    for (const collection of collections) {
      ctx.throwIfAborted();
      try {
        const columns = this.buildColumns(collection.name, { ...params, allTables: true });
        if (!columns.length) continue;
        const title = cleanTitle(collection.options.title, collection.name);
        const fileBaseName = `${title}-${collection.name}`.replace(/[\\/?*[\]:]/g, "_");
        const result = await this.writeTableWorkbook(
          ctx,
          { ...params, filter: null, exportFilter: null, relationFields: [] },
          collection.name,
          columns,
          fileBaseName,
          workDir,
          collected
        );
        files.push(...result.files);
        tableSummaries.push({ name: collection.name, title, rows: result.totalRows });
        totalRows += result.totalRows;
      } catch (error) {
        warnings.push(`\u8868 ${collection.name} \u5BFC\u51FA\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const attachmentEntries = params.exportAttachment ? await this.collectAttachmentFiles(collected) : [];
    const finalName = `\u5168\u90E8\u6570\u636E\u8868-${timestamp}.tar.gz`;
    const finalPath = import_node_path.default.join(workDir, finalName);
    await packTarGz(
      [
        {
          name: "\u5BFC\u51FA\u6E05\u5355.json",
          buffer: Buffer.from(
            JSON.stringify({ tables: tableSummaries, totalRows, exportedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)
          )
        },
        ...files.map((f) => ({ name: import_node_path.default.basename(f), filePath: f })),
        ...attachmentEntries
      ],
      finalPath
    );
    const stat = await import_promises.default.stat(finalPath);
    await this.db.getRepository("sjgl02Tasks").update({
      filter: { id: ctx.taskId },
      values: { filePath: finalPath, fileName: finalName, fileSize: stat.size }
    });
    return {
      totalRows,
      successRows: totalRows,
      errorRows: 0,
      tables: tableSummaries,
      files: [finalName],
      attachmentsPacked: attachmentEntries.length,
      warnings
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ExportEngine
});
