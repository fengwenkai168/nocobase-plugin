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
var import_engine_exports = {};
__export(import_engine_exports, {
  ImportEngine: () => ImportEngine,
  ImportFailedError: () => ImportFailedError
});
module.exports = __toCommonJS(import_engine_exports);
var import_node_path = __toESM(require("node:path"));
var import_utils = require("@nocobase/utils");
var import_excel_parser = require("./excel-parser");
var import_value_converter = require("./value-converter");
var import_attachment = require("./attachment");
var import_field_meta = require("./field-meta");
class ImportRowError extends Error {
  constructor(detail) {
    super(`\u7B2C ${detail.row} \u884C [${detail.field}] ${detail.reason}`);
    this.detail = detail;
  }
}
class ImportFailedError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}
const BATCH_SIZE = 500;
const RELATION_TYPES = ["belongsTo", "hasOne", "hasMany", "belongsToMany"];
class ImportEngine {
  constructor(plugin) {
    this.plugin = plugin;
  }
  get db() {
    return this.plugin.db;
  }
  buildFieldMeta(collectionName, fieldName) {
    return (0, import_field_meta.buildFieldMeta)(this.db, collectionName, fieldName);
  }
  getPkInfo(collectionName) {
    var _a;
    const collection = this.db.getCollection(collectionName);
    if (!collection) throw new Error(`\u6570\u636E\u8868 ${collectionName} \u4E0D\u5B58\u5728`);
    const name = collection.options.filterTargetKey || collection.model.primaryKeyAttribute || "id";
    const field = collection.getField(name);
    const type = String(((_a = field == null ? void 0 : field.options) == null ? void 0 : _a.type) || "bigInt");
    const auto = ["integer", "bigInt"].includes(type) || ["uuid", "nanoid", "snowflakeId", "uid"].includes(type);
    return { name, type, auto };
  }
  async run(ctx, params) {
    const collection = this.db.getCollection(params.collectionName);
    if (!collection) throw new Error(`\u6570\u636E\u8868 ${params.collectionName} \u4E0D\u5B58\u5728`);
    const repo = this.db.getRepository(params.collectionName);
    const pk = this.getPkInfo(params.collectionName);
    const effectiveMapping = params.mapping.filter((m) => m.source !== "ignore");
    const metas = /* @__PURE__ */ new Map();
    for (const item of effectiveMapping) {
      const meta = this.buildFieldMeta(params.collectionName, item.field);
      if (!meta) throw new Error(`\u5B57\u6BB5 ${item.field} \u5728\u6570\u636E\u8868 ${params.collectionName} \u4E2D\u4E0D\u5B58\u5728`);
      metas.set(item.field, meta);
    }
    for (const uniqueField of params.uniqueFields) {
      if (!effectiveMapping.some((m) => m.field === uniqueField)) {
        throw new Error(`\u552F\u4E00\u503C\u5B57\u6BB5 ${uniqueField} \u5FC5\u987B\u5DF2\u914D\u7F6E\u6620\u5C04`);
      }
    }
    let attachmentIndex = null;
    let tempDir = null;
    if (params.attachmentArchivePath) {
      tempDir = (0, import_utils.storagePathJoin)(import_node_path.default.join("sjgl02", "tmp", `task-${ctx.taskId}`));
      attachmentIndex = await (0, import_attachment.extractAttachmentArchive)(params.attachmentArchivePath, import_node_path.default.join(tempDir, "attachments"));
    }
    const fieldConfigs = {};
    for (const item of effectiveMapping) {
      if (item.config) fieldConfigs[item.field] = item.config;
    }
    const convertCtx = {
      db: this.db,
      mode: params.mode,
      blankStrategy: params.blankStrategy,
      fieldConfigs,
      requiredFields: params.requiredFields || [],
      existsCache: /* @__PURE__ */ new Map(),
      pkMetaCache: /* @__PURE__ */ new Map()
    };
    const errors = [];
    const previewRows = [];
    let totalRows = 0;
    let successRows = 0;
    const pkSeen = /* @__PURE__ */ new Set();
    const pkMapping = effectiveMapping.find((m) => m.field === pk.name);
    const pkIsManual = !pk.auto;
    const appendFields = params.mode === "insert" ? [] : effectiveMapping.filter((m) => {
      var _a;
      if (((_a = m.config) == null ? void 0 : _a.updateMode) !== "append") return false;
      const meta = metas.get(m.field);
      return meta && (meta.type === "hasMany" || meta.type === "belongsToMany");
    });
    if (pkIsManual && !pkMapping) {
      throw new Error(`\u6570\u636E\u8868 ${params.collectionName} \u4E3B\u952E(${pk.name})\u4E3A\u624B\u52A8\u578B(${pk.type})\uFF0C\u5FC5\u987B\u6620\u5C04\u4E3B\u952E\u5217`);
    }
    if (params.mode !== "insert" && params.uniqueFields.length === 0) {
      throw new Error("update/upsert \u6A21\u5F0F\u5FC5\u987B\u81F3\u5C11\u9009\u62E9 1 \u4E2A\u552F\u4E00\u503C\u5B57\u6BB5");
    }
    const transaction = await this.db.sequelize.transaction();
    const writeContext = { state: { currentUser: { id: params.operatorUserId } } };
    const pendingAttachments = [];
    try {
      let insertBuffer = [];
      const flushInserts = async () => {
        if (!insertBuffer.length) return;
        await collection.model.bulkCreate(insertBuffer, { transaction, context: writeContext });
        insertBuffer = [];
      };
      for await (const row of (0, import_excel_parser.iterateRows)(params.filePath, params.fileKind, params.sheetName, params.headerRow)) {
        ctx.throwIfAborted();
        totalRows += 1;
        if (totalRows > import_excel_parser.ROW_LIMITS[params.fileKind]) {
          throw new Error(`\u6587\u4EF6\u884C\u6570\u8D85\u8FC7 ${params.fileKind} \u683C\u5F0F\u4E0A\u9650 ${import_excel_parser.ROW_LIMITS[params.fileKind]} \u884C`);
        }
        if (totalRows % 200 === 0) await (0, import_excel_parser.yieldEventLoop)();
        const prepared = await this.prepareRow(
          row.rowNumber,
          row.values,
          effectiveMapping,
          metas,
          convertCtx,
          params,
          attachmentIndex,
          pk,
          pkMapping
        );
        if (previewRows.length < 10) previewRows.push(prepared.values);
        if (pkMapping && params.mode !== "update") {
          const pkValue = prepared.values[pk.name];
          if ((0, import_value_converter.isBlank)(pkValue))
            throw new ImportRowError({ row: row.rowNumber, field: pk.name, reason: "\u624B\u52A8\u578B\u4E3B\u952E\u503C\u4E3A\u7A7A", raw: pkValue });
          if (pkSeen.has(pkValue))
            throw new ImportRowError({
              row: row.rowNumber,
              field: pk.name,
              reason: "\u4E3B\u952E\u503C\u4E0E\u672C\u6279\u6B21\u5176\u4ED6\u884C\u91CD\u590D",
              raw: pkValue
            });
          pkSeen.add(pkValue);
        }
        if (params.mode === "insert") {
          if (prepared.hasRelations || prepared.attachments.length) {
            await flushInserts();
            const created = await repo.create({ values: prepared.values, transaction, context: writeContext });
            for (const att of prepared.attachments) pendingAttachments.push({ rowPk: created.get(pk.name), ...att });
          } else {
            insertBuffer.push(prepared.values);
            if (insertBuffer.length >= BATCH_SIZE) await flushInserts();
          }
          successRows += 1;
        } else {
          await flushInserts();
          const existing = prepared.uniqueFilter ? await repo.findOne({
            filter: prepared.uniqueFilter,
            appends: appendFields.length ? appendFields.map((f) => f.field) : void 0,
            transaction
          }) : null;
          if (existing) {
            if (appendFields.length) {
              await this.mergeAppendRelations(existing, prepared.values, appendFields, metas);
            }
            await repo.update({
              filter: prepared.uniqueFilter,
              values: prepared.values,
              transaction,
              context: writeContext
            });
            for (const att of prepared.attachments) pendingAttachments.push({ rowPk: existing.get(pk.name), ...att });
          } else if (params.mode === "upsert") {
            const created = await repo.create({ values: prepared.values, transaction, context: writeContext });
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
        attachments: attachmentResult
      };
    } catch (error) {
      await transaction.rollback();
      if (error instanceof Error && error.message === "__aborted__") {
        throw error;
      }
      if (error instanceof ImportRowError) {
        errors.push(error.detail);
      }
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError" && pkMapping) {
        errors.push({ row: 0, field: pk.name, reason: "\u4E3B\u952E\u503C\u4E0E\u6570\u636E\u5E93\u5DF2\u6709\u8BB0\u5F55\u91CD\u590D", raw: null });
      }
      const message = errors.length ? `\u5BFC\u5165\u5931\u8D25\uFF1A${errors[0].reason}\uFF08\u5B57\u6BB5 ${errors[0].field}${errors[0].row ? `\uFF0C\u7B2C ${errors[0].row} \u884C` : ""}\uFF09\uFF0C\u5DF2\u6574\u6279\u56DE\u6EDA` : `\u5BFC\u5165\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}\uFF0C\u5DF2\u6574\u6279\u56DE\u6EDA`;
      throw new ImportFailedError(message, {
        totalRows,
        successRows: 0,
        errorRows: totalRows,
        errors: errors.slice(0, 100),
        previewRows,
        rolledBack: true
      });
    }
  }
  async prepareRow(rowNumber, values, mapping, metas, convertCtx, params, attachmentIndex, pk, pkMapping) {
    const out = {};
    let hasRelations = false;
    const attachments = [];
    const uniqueFilter = {};
    for (const item of mapping) {
      const meta = metas.get(item.field);
      const raw = item.source === "custom" ? item.value : values[item.columnIndex ?? -1];
      if (meta.attachment) {
        const cfg = item.config || {};
        if (params.attachmentArchivePath) {
          if ((0, import_value_converter.isBlank)(raw)) {
            if (cfg.emptyStrategy === "clear" && params.mode !== "insert") {
              attachments.push({ field: item.field, folder: "", fileNames: [], updateMode: "overwrite", clear: true });
            }
          } else {
            if (!cfg.folder) {
              throw new ImportRowError({
                row: rowNumber,
                field: item.field,
                reason: "\u9644\u4EF6\u5B57\u6BB5\u672A\u9009\u62E9\u538B\u7F29\u5305\u5185\u6587\u4EF6\u5939",
                raw
              });
            }
            const inputNames = String(raw).split(/[,，]/).map((v) => v.trim()).filter(Boolean);
            const fileNames = [];
            for (const fileName of inputNames) {
              if (!(0, import_attachment.isAllowedAttachment)(fileName)) {
                throw new ImportRowError({
                  row: rowNumber,
                  field: item.field,
                  reason: "\u6587\u4EF6\u683C\u5F0F\u4E0D\u88AB\u7CFB\u7EDF\u5141\u8BB8",
                  raw: fileName
                });
              }
              if (!(0, import_attachment.attachmentExists)(attachmentIndex, cfg.folder, fileName)) {
                if (cfg.notFound === "skip") continue;
                throw new ImportRowError({
                  row: rowNumber,
                  field: item.field,
                  reason: `\u6587\u4EF6\u5939 ${cfg.folder} \u4E0B\u627E\u4E0D\u5230\u5BF9\u5E94\u7684\u6587\u4EF6\u540D`,
                  raw: fileName
                });
              }
              fileNames.push(fileName);
            }
            if (fileNames.length) {
              attachments.push({
                field: item.field,
                folder: cfg.folder,
                fileNames,
                updateMode: cfg.updateMode === "append" && params.mode !== "insert" ? "append" : "overwrite",
                clear: false
              });
            }
          }
        } else if (!(0, import_value_converter.isBlank)(raw)) {
          throw new ImportRowError({ row: rowNumber, field: item.field, reason: "\u672A\u4E0A\u4F20\u9644\u4EF6\u538B\u7F29\u5305\u4F46\u9644\u4EF6\u5217\u6709\u503C", raw });
        }
        continue;
      }
      if ((0, import_value_converter.isSystemField)(item.field)) {
        if (item.field === "createdAt" || item.field === "updatedAt") {
          if (!(0, import_value_converter.isBlank)(raw)) {
            const date = (0, import_value_converter.parseDateValue)(raw);
            if (!date) throw new ImportRowError({ row: rowNumber, field: item.field, reason: "\u65E5\u671F\u683C\u5F0F\u65E0\u6CD5\u89E3\u6790", raw });
            out[item.field] = date;
          }
        } else {
          if (!(0, import_value_converter.isBlank)(raw)) {
            const userId = Number(raw);
            if (!Number.isInteger(userId))
              throw new ImportRowError({ row: rowNumber, field: item.field, reason: "\u7528\u6237ID\u683C\u5F0F\u9519\u8BEF", raw });
            const exists = await this.db.getRepository("users").findOne({ filter: { id: userId }, fields: ["id"] });
            if (!exists)
              throw new ImportRowError({ row: rowNumber, field: item.field, reason: "\u586B\u7684\u7528\u6237ID\u5728\u7CFB\u7EDF\u4E2D\u4E0D\u5B58\u5728", raw });
            out[item.field] = userId;
          }
        }
        continue;
      }
      const result = await (0, import_value_converter.convertFieldValue)(meta, raw, convertCtx);
      if (result.status === "error") {
        throw new ImportRowError({ row: rowNumber, field: item.field, reason: result.error, raw });
      }
      if (result.status === "skip") continue;
      if (RELATION_TYPES.includes(meta.type)) hasRelations = true;
      out[item.field] = result.value;
    }
    const now = /* @__PURE__ */ new Date();
    if (params.mode === "insert" || params.mode === "upsert") {
      if (!("createdAt" in out)) out.createdAt = now;
      if (!("createdById" in out)) out.createdById = params.operatorUserId;
    }
    if (!("updatedAt" in out)) out.updatedAt = now;
    if (!("updatedById" in out)) out.updatedById = params.operatorUserId;
    if (params.mode !== "insert") {
      for (const uniqueField of params.uniqueFields) {
        const value = out[uniqueField];
        if ((0, import_value_converter.isBlank)(value)) {
          throw new ImportRowError({
            row: rowNumber,
            field: uniqueField,
            reason: "\u552F\u4E00\u503C\u5B57\u6BB5\u4E3A\u7A7A\uFF08update/upsert \u6A21\u5F0F\u4E0D\u5141\u8BB8\uFF09",
            raw: value
          });
        }
        uniqueFilter[uniqueField] = value;
      }
    }
    return {
      rowNumber,
      values: out,
      hasRelations,
      uniqueFilter: params.mode === "insert" ? null : uniqueFilter,
      attachments
    };
  }
  async mergeAppendRelations(existing, values, appendFields, metas) {
    const record = existing;
    for (const item of appendFields) {
      const incoming = values[item.field];
      if (!Array.isArray(incoming) || !incoming.length) continue;
      const meta = metas.get(item.field);
      if (!(meta == null ? void 0 : meta.target)) continue;
      const targetPk = this.getPkInfo(meta.target).name;
      const current = record.get(item.field);
      const currentIds = (Array.isArray(current) ? current : []).map((r) => {
        const m = r;
        return typeof (m == null ? void 0 : m.get) === "function" ? m.get(targetPk) : (m == null ? void 0 : m.id) ?? r;
      });
      const merged = [...currentIds];
      for (const v of incoming) {
        if (!merged.some((x) => String(x) === String(v))) merged.push(v);
      }
      values[item.field] = merged;
    }
  }
  async processAttachments(ctx, pending, index, params, pkName) {
    if (!pending.length || !index) return { uploaded: 0 };
    const repo = this.db.getRepository(params.collectionName);
    let uploaded = 0;
    let processed = 0;
    const warnings = [];
    for (const item of pending) {
      ctx.throwIfAborted();
      processed += 1;
      if (processed % 50 === 0) await (0, import_excel_parser.yieldEventLoop)();
      try {
        const recordIds = [];
        for (const fileName of item.fileNames) {
          const filePath = import_node_path.default.join(index.dir, item.folder, fileName);
          const record = await (0, import_attachment.createAttachmentRecord)(this.db, filePath, fileName);
          recordIds.push(record.id);
        }
        let finalIds = recordIds;
        if (item.updateMode === "append" && !item.clear) {
          const existing = await repo.findOne({ filterByTk: item.rowPk, appends: [item.field] });
          const oldItems = (existing == null ? void 0 : existing.get(item.field)) || [];
          const oldIds = oldItems.map((r) => typeof (r == null ? void 0 : r.get) === "function" ? r.get("id") : (r == null ? void 0 : r.id) ?? r);
          finalIds = [.../* @__PURE__ */ new Set([...oldIds, ...recordIds])];
        }
        await repo.update({
          filter: { [pkName]: item.rowPk },
          values: { [item.field]: finalIds }
        });
        uploaded += recordIds.length;
      } catch (error) {
        warnings.push(
          `\u884C\u4E3B\u952E ${item.rowPk} \u5B57\u6BB5 ${item.field}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return { uploaded, warnings };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ImportEngine,
  ImportFailedError
});
