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
var export_exports = {};
__export(export_exports, {
  downloadExport: () => downloadExport,
  executeExport: () => executeExport,
  getExportTableFields: () => getExportTableFields,
  getProgress: () => getProgress,
  previewCount: () => previewCount
});
module.exports = __toCommonJS(export_exports);
var import_exceljs = __toESM(require("exceljs"));
var import_fs = __toESM(require("fs"));
var import_promises = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var import_archiver = __toESM(require("archiver"));
var import_async_mutex = require("async-mutex");
var import_permission_check = require("./permission-check");
var import_taskLogs = require("./taskLogs");
var import_cancel_state = require("./cancel-state");
const exportMutex = new import_async_mutex.Mutex();
function sanitizeSheetName(name) {
  return name.replace(/[\\\/\*\?\[\]:!@#\$%\^&\(\)]/g, "_").substring(0, 31);
}
function formatFileName(template, tableName) {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return template.replace(/\{表名\}/g, tableName).replace(/\{日期\}/g, date);
}
function getFieldDisplayName(coll, fieldName, style) {
  var _a, _b;
  try {
    const f = coll.fields instanceof Map ? coll.fields.get(fieldName) : null;
    const title = (_b = (_a = f == null ? void 0 : f.options) == null ? void 0 : _a.uiSchema) == null ? void 0 : _b.title;
    if (title && !/^\{\{/.test(title)) {
      if (style === "id") return fieldName;
      if (style === "title") return title;
      return `${title}(${fieldName})`;
    }
  } catch {
  }
  return fieldName;
}
function getCollDisplayName(coll, style) {
  var _a;
  const rawName = (coll == null ? void 0 : coll.name) || "";
  let title = ((_a = coll == null ? void 0 : coll.options) == null ? void 0 : _a.title) || rawName;
  if (/^\{\{/.test(title)) title = rawName;
  if (style === "id") return rawName;
  if (style === "title") return title;
  return title !== rawName ? `${title}(${rawName})` : rawName;
}
function ensureUniqueSheetName(workbook, name) {
  const existing = new Set((workbook.worksheets || []).map((s) => s.name));
  if (!existing.has(name)) return name;
  let i = 1;
  while (existing.has(`${name}_${i}`)) i++;
  return `${name}_${i}`;
}
function formatValue(val) {
  if (val === null || val === void 0) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}
function getScalarFields(coll) {
  var _a;
  if (!coll) return [];
  const names = [];
  try {
    for (const f of Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || [])) {
      const type = f.type;
      if (!["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(type)) {
        names.push(f.name);
      }
    }
  } catch {
  }
  return names;
}
function getAssociationFields(coll) {
  var _a, _b;
  if (!coll) return [];
  const fields = [];
  try {
    for (const f of Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || [])) {
      const type = f.type;
      if (["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(type)) {
        fields.push({
          name: f.name,
          type,
          target: ((_b = f.options) == null ? void 0 : _b.target) || f.target || ""
        });
      }
    }
  } catch {
  }
  return fields;
}
function detectPkType(coll) {
  var _a, _b;
  try {
    const fields = Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || []);
    const pk = fields.find((f) => {
      var _a2;
      return (_a2 = f.options) == null ? void 0 : _a2.primaryKey;
    });
    if (!pk) return "other";
    const pkType = String(pk.type || "");
    if (pkType.includes("UUID") || pkType.includes("uuid")) return "uuid";
    const autoIncr = (_b = pk.options) == null ? void 0 : _b.autoIncrement;
    if (autoIncr !== false && (pkType.includes("INT") || pkType.includes("int") || pkType === "bigInt" || pkType === "BIGINT")) {
      return "int_auto";
    }
    if (pkType.includes("INT") || pkType.includes("int") || pkType === "bigInt" || pkType === "BIGINT") return "int_auto";
    return "other";
  } catch {
    return "other";
  }
}
async function getExportTableFields(ctx, next) {
  var _a;
  const { tableName } = ctx.action.params;
  if (!tableName || tableName === "__all__") {
    ctx.body = [];
    await next();
    return;
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, `Table ${tableName} not found`);
  }
  let rawFields = [];
  try {
    rawFields = Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || []);
  } catch {
    rawFields = [];
  }
  const autoFields = ["id", "createdAt", "updatedAt", "createdBy", "updatedBy", "createdById", "updatedById"];
  const fkSet = /* @__PURE__ */ new Set();
  rawFields.forEach((f) => {
    var _a2;
    if (f.type === "belongsTo" && ((_a2 = f.options) == null ? void 0 : _a2.foreignKey)) {
      fkSet.add(f.options.foreignKey);
    }
  });
  const fields = rawFields.map((f) => {
    var _a2, _b, _c, _d, _e;
    let title = ((_b = (_a2 = f.options) == null ? void 0 : _a2.uiSchema) == null ? void 0 : _b.title) || null;
    if (title && /^\{\{/.test(title)) title = null;
    if (!title) title = f.name;
    return {
      name: f.name,
      type: f.type,
      uiSchema: { ...((_c = f.options) == null ? void 0 : _c.uiSchema) || {}, title },
      interface: ((_d = f.options) == null ? void 0 : _d.interface) || null,
      isRequired: autoFields.includes(f.name) ? false : ((_e = f.options) == null ? void 0 : _e.allowNull) === false,
      isAssociation: ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type),
      isForeignKey: fkSet.has(f.name)
    };
  });
  ctx.body = fields;
  await next();
}
async function previewCount(ctx, next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { tableName, filter } = params;
  if (!tableName || tableName === "__all__") {
    let total = 0;
    const collections = ctx.db.collections;
    for (const [name, coll] of collections) {
      try {
        const repo2 = ctx.db.getRepository(name);
        if (repo2) total += await repo2.count({ filter: filter || {} });
      } catch {
      }
    }
    ctx.body = { estimatedRows: total };
    await next();
    return;
  }
  const repo = ctx.db.getRepository(tableName);
  const count = repo ? await repo.count({ filter: filter || {} }) : 0;
  ctx.body = { estimatedRows: count };
  await next();
}
async function executeExport(ctx, next) {
  var _a;
  const params = ctx.action.params.values || ctx.action.params;
  const {
    tableName,
    selectedFields,
    associationDisplayMode,
    includeAssociationSheet,
    associationSheetTables,
    filter,
    fileNameTemplate,
    includeAttachments,
    headerStyle
  } = params;
  const exportFilter = (() => {
    if (!filter) return {};
    if (Array.isArray(filter)) {
      const obj = {};
      for (const cond of filter) {
        if (cond.field && cond.op && cond.value !== void 0) {
          const opMap = { eq: "$eq", contains: "$includes", gt: "$gt", lt: "$lt" };
          obj[cond.field] = { [opMap[cond.op] || "$eq"]: cond.value };
        }
      }
      return obj;
    }
    return filter;
  })();
  if (!tableName) {
    ctx.throw(400, "tableName is required");
  }
  if (tableName !== "__all__") {
    const exportPerm = await (0, import_permission_check.checkExportPermission)(ctx, tableName);
    if (exportPerm.exportFields && exportPerm.exportFields.length > 0 && selectedFields && selectedFields.length > 0) {
      const invalidFields = selectedFields.filter((f) => !exportPerm.exportFields.includes(f));
      if (invalidFields.length > 0) {
        ctx.throw(403, `\u60A8\u7684\u6743\u9650\u4E0D\u5141\u8BB8\u5BFC\u51FA\u4EE5\u4E0B\u5B57\u6BB5\uFF1A${invalidFields.join("\u3001")}\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458`);
      }
    }
  }
  let allowedTableList = null;
  if (tableName === "__all__") {
    const names = [];
    const collections = ctx.db.collections;
    for (const [name] of collections) {
      try {
        const permCheck = await (0, import_permission_check.checkExportPermission)(ctx, name);
        if (permCheck.canExport) names.push(name);
      } catch {
      }
    }
    allowedTableList = names;
  }
  let estimatedTotal = 0;
  try {
    if (tableName === "__all__" && allowedTableList) {
      for (const t of allowedTableList) {
        try {
          const repo2 = ctx.db.getRepository(t);
          if (repo2) estimatedTotal += await repo2.count({ filter: exportFilter || {} });
        } catch {
        }
      }
    } else {
      const tRepo = ctx.db.getRepository(tableName);
      if (tRepo) estimatedTotal = await tRepo.count({ filter: exportFilter || {} });
    }
  } catch {
  }
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.create({
    values: {
      taskType: "export",
      tableName,
      status: "pending",
      selectedFields: selectedFields || [],
      exportFilter: exportFilter || {},
      associationDisplayMode: associationDisplayMode || {},
      includeAssociationSheet: includeAssociationSheet || false,
      associationSheetTables: associationSheetTables || [],
      includeAttachments: includeAttachments || false,
      totalRows: estimatedTotal,
      progress: 0,
      fileName: tableName === "__all__" ? `\u5168\u90E8\u6570\u636E\u8868_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.tar.gz` : "",
      createdById: (_a = ctx.state.currentUser) == null ? void 0 : _a.id,
      headerStyle: headerStyle || "title_id"
    }
  });
  const db = ctx.db;
  const taskId = task.id;
  ctx.body = { taskId };
  await next();
  setImmediate(() => {
    processExportAsync(db, taskId, {
      tableName,
      selectedFields,
      associationDisplayMode,
      includeAssociationSheet,
      associationSheetTables,
      exportFilter,
      fileNameTemplate,
      includeAttachments,
      headerStyle,
      allowedTableList
    });
  });
}
async function processExportAsync(db, taskId, params) {
  var _a, _b, _c;
  const {
    tableName,
    selectedFields,
    associationDisplayMode,
    includeAssociationSheet,
    associationSheetTables,
    exportFilter,
    fileNameTemplate,
    includeAttachments,
    headerStyle,
    allowedTableList
  } = params;
  const repo = db.getRepository("sjgl02_tasks");
  const release = await exportMutex.acquire();
  try {
    await repo.update({ filterByTk: taskId, values: { status: "processing" } });
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u5F00\u59CB\u6267\u884C\u5BFC\u51FA\u4EFB\u52A1");
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", `\u76EE\u6807\u6570\u636E\u8868: ${tableName}${tableName === "__all__" ? "\uFF08\u5168\u90E8\u6570\u636E\u8868\uFF09" : ""}`);
    const isAllTables = tableName === "__all__";
    const tableList = isAllTables ? allowedTableList || [] : [tableName];
    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
    const tempDir = import_path.default.join(storageDir, "exports");
    if (!import_fs.default.existsSync(tempDir)) import_fs.default.mkdirSync(tempDir, { recursive: true });
    let totalRows = 0;
    try {
      const t = await repo.findOne({ filter: { id: taskId }, raw: true });
      if ((t == null ? void 0 : t.totalRows) > 0) totalRows = t.totalRows;
    } catch {
    }
    let processedRows = 0;
    const outputFiles = [];
    let cancelled = false;
    const allAttachFileEntries = [];
    let streamArchive = null;
    let streamOutput = null;
    let streamZipPath = "";
    if (isAllTables) {
      streamZipPath = import_path.default.join(tempDir, `sjgl02_export_${taskId}_${Date.now()}.tar.gz`);
      streamOutput = import_fs.default.createWriteStream(streamZipPath);
      streamArchive = (0, import_archiver.default)("tar", { gzip: true, gzipOptions: { level: 1 } });
      streamArchive.pipe(streamOutput);
      streamArchive.on("error", (e) => {
        throw e;
      });
    }
    for (const tblName of tableList) {
      if (import_cancel_state.cancelFlags.has(taskId)) {
        cancelled = true;
        break;
      }
      const coll = db.getCollection(tblName);
      if (!coll) continue;
      const targetRepo = db.getRepository(tblName);
      if (!targetRepo) continue;
      let collectionTotal = 0;
      const appendFields = [];
      const attachmentFieldNames = [];
      const fileIdFieldNames = [];
      try {
        for (const f of Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || [])) {
          if (f.type === "belongsTo") appendFields.push(f.name);
          if (f.type === "belongsToMany") {
            const interfaceName = (_b = f.options) == null ? void 0 : _b.interface;
            if (includeAttachments && interfaceName === "attachment" && !appendFields.includes(f.name)) {
              appendFields.push(f.name);
              attachmentFieldNames.push(f.name);
            } else if (!includeAttachments || interfaceName !== "attachment") {
              if (!(selectedFields == null ? void 0 : selectedFields.length) || selectedFields.includes(f.name)) {
                if (!appendFields.includes(f.name)) appendFields.push(f.name);
              }
            }
          }
          if (f.type === "hasMany" || f.type === "hasOne") {
            if (!(selectedFields == null ? void 0 : selectedFields.length) || selectedFields.includes(f.name)) {
              if (!appendFields.includes(f.name)) appendFields.push(f.name);
            }
          }
          if (includeAttachments && f.type === "integer" && /FileId$/.test(f.name)) {
            fileIdFieldNames.push(f.name);
          }
        }
      } catch {
      }
      try {
        const [, c] = await targetRepo.findAndCount({ filter: exportFilter || {}, limit: 1 });
        collectionTotal = c;
      } catch {
      }
      if (collectionTotal === 0) continue;
      const fieldNames = selectedFields && selectedFields.length > 0 ? selectedFields : getScalarFields(coll);
      if (!fieldNames || fieldNames.length === 0) continue;
      const collDisplay = sanitizeSheetName(getCollDisplayName(coll, headerStyle)).replace(/\s+/g, "_");
      const xlsxName = `sjgl02_export_${taskId}_${Date.now()}.xlsx`;
      const filePath = import_path.default.join(tempDir, xlsxName);
      const streamWriter = new import_exceljs.default.stream.xlsx.WorkbookWriter({
        filename: filePath,
        useStyles: true,
        useSharedStrings: true
      });
      streamWriter.creator = "NocoBase @my-project/plugin-sjgl02";
      const mainSheet = streamWriter.addWorksheet(
        ensureUniqueSheetName(streamWriter, sanitizeSheetName(getCollDisplayName(coll, headerStyle)))
      );
      mainSheet.columns = fieldNames.map((name) => ({
        header: getFieldDisplayName(coll, name, headerStyle),
        key: name,
        width: Math.max(getFieldDisplayName(coll, name, headerStyle).length + 4, 20)
      }));
      mainSheet.getRow(1).font = { bold: true };
      mainSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      const attachIds = /* @__PURE__ */ new Set();
      const attachFieldMap = /* @__PURE__ */ new Map();
      const PAGE_SIZE = 5e3;
      const pkType = detectPkType(coll);
      if (pkType === "int_auto") {
        let lastId = 0;
        while (true) {
          if (import_cancel_state.cancelFlags.has(taskId)) {
            cancelled = true;
            break;
          }
          const pageRecords = await targetRepo.find({
            filter: { ...exportFilter || {}, id: { $gt: lastId } },
            sort: ["id"],
            limit: PAGE_SIZE,
            ...appendFields.length > 0 ? { appends: appendFields } : {}
          });
          if (pageRecords.length === 0) break;
          for (const record of pageRecords) {
            const row = {};
            for (const f of fieldNames) {
              let val = record[f];
              if (attachmentFieldNames.includes(f)) {
                if (Array.isArray(val) && val.length > 0) {
                  for (const a of val) {
                    if ((a == null ? void 0 : a.id) && !attachIds.has(a.id)) {
                      attachIds.add(a.id);
                      attachFieldMap.set(a.id, f);
                    }
                  }
                  val = val.map((a) => a.filename || a.title || a.id || "").join(", ");
                } else val = "";
              } else if (fileIdFieldNames.includes(f)) {
                if (val !== null && val !== void 0 && !attachIds.has(Number(val))) {
                  attachIds.add(Number(val));
                  attachFieldMap.set(Number(val), f);
                }
                val = val !== null && val !== void 0 ? String(val) : "";
              } else if (Array.isArray(val)) {
                val = val.map((item) => {
                  const name = item.nickname || item.name || item.title || item.id || "";
                  return name ? `${name}(\u4E3B\u952E\uFF1A${item.id})` : "";
                }).filter(Boolean).join(", ");
              } else if (val !== null && val !== void 0 && typeof val === "object" && !(val instanceof Date)) {
                val = val.nickname || val.username || val.name || val.email || val.id || JSON.stringify(val);
              }
              row[f] = formatValue(val);
            }
            mainSheet.addRow(row).commit();
            processedRows++;
          }
          lastId = Number(pageRecords[pageRecords.length - 1].id);
          const progress = Math.min(100, Math.floor(processedRows / Math.max(1, collectionTotal) * 100));
          try {
            await repo.update({ filterByTk: taskId, values: { processedRows, totalRows, progress } });
          } catch {
          }
        }
      } else if (pkType === "uuid") {
        try {
          await db.sequelize.query("SET SESSION statement_timeout = '30min'");
        } catch {
        }
        const allIds = [];
        let uuidOffset = 0;
        while (true) {
          const idPage = await targetRepo.find({
            filter: exportFilter || {},
            fields: ["id"],
            offset: uuidOffset,
            limit: PAGE_SIZE
          });
          if (idPage.length === 0) break;
          allIds.push(...idPage.map((r) => r.id));
          uuidOffset += PAGE_SIZE;
        }
        for (let bi = 0; bi < allIds.length; bi += PAGE_SIZE) {
          if (import_cancel_state.cancelFlags.has(taskId)) {
            cancelled = true;
            break;
          }
          const batch = allIds.slice(bi, bi + PAGE_SIZE);
          const pageRecords = await targetRepo.find({
            filter: { ...exportFilter || {}, id: { $in: batch } },
            limit: PAGE_SIZE,
            ...appendFields.length > 0 ? { appends: appendFields } : {}
          });
          for (const record of pageRecords) {
            const row = {};
            for (const f of fieldNames) {
              let val = record[f];
              if (attachmentFieldNames.includes(f)) {
                if (Array.isArray(val) && val.length > 0) {
                  for (const a of val) {
                    if ((a == null ? void 0 : a.id) && !attachIds.has(a.id)) {
                      attachIds.add(a.id);
                      attachFieldMap.set(a.id, f);
                    }
                  }
                  val = val.map((a) => a.filename || a.title || a.id || "").join(", ");
                } else val = "";
              } else if (fileIdFieldNames.includes(f)) {
                if (val !== null && val !== void 0 && !attachIds.has(Number(val))) {
                  attachIds.add(Number(val));
                  attachFieldMap.set(Number(val), f);
                }
                val = val !== null && val !== void 0 ? String(val) : "";
              } else if (Array.isArray(val)) {
                val = val.map((item) => {
                  const name = item.nickname || item.name || item.title || item.id || "";
                  return name ? `${name}(\u4E3B\u952E\uFF1A${item.id})` : "";
                }).filter(Boolean).join(", ");
              } else if (val !== null && val !== void 0 && typeof val === "object" && !(val instanceof Date)) {
                val = val.nickname || val.username || val.name || val.email || val.id || JSON.stringify(val);
              }
              row[f] = formatValue(val);
            }
            mainSheet.addRow(row).commit();
            processedRows++;
          }
          const progress = Math.min(100, Math.floor(processedRows / Math.max(1, collectionTotal) * 100));
          try {
            await repo.update({ filterByTk: taskId, values: { processedRows, totalRows, progress } });
          } catch {
          }
        }
      } else {
        let offset = 0;
        while (offset < collectionTotal) {
          if (import_cancel_state.cancelFlags.has(taskId)) {
            cancelled = true;
            break;
          }
          const pageRecords = await targetRepo.find({
            filter: exportFilter || {},
            offset,
            limit: PAGE_SIZE,
            ...appendFields.length > 0 ? { appends: appendFields } : {}
          });
          if (pageRecords.length === 0) break;
          for (const record of pageRecords) {
            const row = {};
            for (const f of fieldNames) {
              let val = record[f];
              if (attachmentFieldNames.includes(f)) {
                if (Array.isArray(val) && val.length > 0) {
                  for (const a of val) {
                    if ((a == null ? void 0 : a.id) && !attachIds.has(a.id)) {
                      attachIds.add(a.id);
                      attachFieldMap.set(a.id, f);
                    }
                  }
                  val = val.map((a) => a.filename || a.title || a.id || "").join(", ");
                } else val = "";
              } else if (fileIdFieldNames.includes(f)) {
                if (val !== null && val !== void 0 && !attachIds.has(Number(val))) {
                  attachIds.add(Number(val));
                  attachFieldMap.set(Number(val), f);
                }
                val = val !== null && val !== void 0 ? String(val) : "";
              } else if (Array.isArray(val)) {
                val = val.map((item) => {
                  const name = item.nickname || item.name || item.title || item.id || "";
                  return name ? `${name}(\u4E3B\u952E\uFF1A${item.id})` : "";
                }).filter(Boolean).join(", ");
              } else if (val !== null && val !== void 0 && typeof val === "object" && !(val instanceof Date)) {
                val = val.nickname || val.username || val.name || val.email || val.id || JSON.stringify(val);
              }
              row[f] = formatValue(val);
            }
            mainSheet.addRow(row).commit();
            processedRows++;
          }
          offset += PAGE_SIZE;
          const progress = Math.min(100, Math.floor(offset * 100 / Math.max(1, collectionTotal)));
          try {
            await repo.update({ filterByTk: taskId, values: { processedRows, totalRows, progress } });
          } catch {
          }
        }
      }
      if (cancelled) break;
      if (includeAssociationSheet) {
        const assocFields = getAssociationFields(coll);
        for (const af of assocFields.filter((af2) => !fieldNames.length || fieldNames.includes(af2.name))) {
          const assocRepo = db.getRepository(af.target);
          if (!assocRepo) continue;
          let assocTotal = 0;
          try {
            const [, cnt] = await assocRepo.findAndCount({ limit: 1 });
            assocTotal = cnt;
          } catch {
          }
          if (assocTotal === 0) continue;
          const assocColl = db.getCollection(af.target);
          const assocScalarFields = getScalarFields(assocColl);
          if (!assocScalarFields || assocScalarFields.length === 0) continue;
          const fieldDisplay = getFieldDisplayName(coll, af.name, headerStyle);
          const sheetDisplay = getCollDisplayName(assocColl, headerStyle);
          const sheetName = ensureUniqueSheetName(streamWriter, sanitizeSheetName(fieldDisplay + "-" + sheetDisplay).substring(0, 31));
          const assocSheet = streamWriter.addWorksheet(sheetName);
          assocSheet.columns = assocScalarFields.map((n) => ({
            header: getFieldDisplayName(assocColl, n, headerStyle),
            key: n,
            width: Math.max(getFieldDisplayName(assocColl, n, headerStyle).length + 4, 20)
          }));
          assocSheet.getRow(1).font = { bold: true };
          assocSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
          let aOff = 0;
          while (aOff < assocTotal) {
            if (import_cancel_state.cancelFlags.has(taskId)) {
              cancelled = true;
              break;
            }
            const aRecs = await assocRepo.find({ offset: aOff, limit: PAGE_SIZE });
            for (const rec of aRecs) {
              const row = {};
              for (const f of assocScalarFields) {
                let val = rec[f];
                if (val !== null && val !== void 0 && typeof val === "object" && !(val instanceof Date))
                  val = val.nickname || val.title || val.name || val.id || JSON.stringify(val);
                row[f] = formatValue(val);
              }
              assocSheet.addRow(row).commit();
              processedRows++;
            }
            aOff += PAGE_SIZE;
            const ap = Math.min(100, Math.floor(aOff * 100 / Math.max(1, assocTotal)));
            try {
              await repo.update({ filterByTk: taskId, values: { processedRows, totalRows, progress: Math.max(ap, 0) } });
            } catch {
            }
          }
          if (cancelled) break;
          assocSheet.commit();
        }
      }
      mainSheet.commit();
      await streamWriter.commit();
      if (cancelled) break;
      let finalFilePath2 = filePath;
      if (includeAttachments && attachIds.size > 0) {
        const fileIdFilenameMap = /* @__PURE__ */ new Map();
        try {
          const ar = await db.getRepository("attachments").find({ filter: { id: Array.from(attachIds) } });
          ar.forEach((at) => {
            if (at.filename) fileIdFilenameMap.set(at.id, at.filename);
          });
        } catch {
        }
        if (fileIdFilenameMap.size > 0) {
          try {
            const attachmentFiles = [];
            for (const [aid, fn] of fileIdFilenameMap) {
              let realPath = import_path.default.join(storageDir, fn);
              if (!import_fs.default.existsSync(realPath)) {
                const atRecords = await db.getRepository("attachments").find({ filter: { id: [aid] } });
                if (((_c = atRecords[0]) == null ? void 0 : _c.path) !== void 0) {
                  realPath = import_path.default.join(storageDir, atRecords[0].path || "", fn);
                }
              }
              if (!import_fs.default.existsSync(realPath)) continue;
              const afName = attachFieldMap.get(aid) || "\u9644\u4EF6";
              const folderName = sanitizeSheetName(getFieldDisplayName(coll, afName, headerStyle));
              const attPrefix = isAllTables ? `${collDisplay}/` : "";
              attachmentFiles.push({ entryName: `${attPrefix}${folderName}/${fn}`, diskPath: realPath });
            }
            if (attachmentFiles.length > 0) {
              if (isAllTables) {
                allAttachFileEntries.push(...attachmentFiles);
              } else {
                const zipName = `sjgl02_export_${taskId}_${Date.now()}.tar.gz`;
                const zipPath = import_path.default.join(tempDir, zipName);
                try {
                  const zipOutput = import_fs.default.createWriteStream(zipPath);
                  const zipArchive = (0, import_archiver.default)("tar", { gzip: true, gzipOptions: { level: 1 } });
                  await new Promise((resolve, reject) => {
                    zipArchive.on("error", reject);
                    zipOutput.on("close", resolve);
                    zipOutput.on("error", reject);
                    zipArchive.pipe(zipOutput);
                    zipArchive.file(filePath, { name: import_path.default.basename(filePath) });
                    for (const af of attachmentFiles) {
                      zipArchive.file(af.diskPath, { name: af.entryName });
                    }
                    zipArchive.finalize();
                  });
                  try {
                    import_fs.default.unlinkSync(filePath);
                  } catch {
                  }
                  outputFiles.push(zipPath);
                  finalFilePath2 = zipPath;
                } catch (attErr) {
                  await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", `\u9644\u4EF6\u6253\u5305\u5931\u8D25(${tblName}): ${attErr.message || String(attErr)}\uFF0C\u8DF3\u8FC7\u6253\u5305`);
                }
              }
            }
          } catch {
          }
        }
      }
      if (isAllTables && !cancelled && streamArchive) {
        try {
          const internalName = `${collDisplay}.xlsx`;
          const readablePath = import_path.default.join(import_path.default.dirname(finalFilePath2), internalName);
          import_fs.default.renameSync(finalFilePath2, readablePath);
          finalFilePath2 = readablePath;
          streamArchive.file(readablePath, { name: internalName });
          outputFiles.push(finalFilePath2);
        } catch (zipErr) {
          await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", `\u8FFD\u52A0\u5230 ZIP \u5931\u8D25(${tblName}): ${zipErr.message || ""}`);
        }
      } else if (!isAllTables) {
        if (!outputFiles.includes(finalFilePath2)) {
          outputFiles.push(finalFilePath2);
        }
      }
      await repo.update({
        filterByTk: taskId,
        values: { progress: Math.min(100, Math.floor(processedRows / Math.max(totalRows, 1) * 100)), processedRows, totalRows }
      });
    }
    if (isAllTables && streamArchive && !cancelled) {
      try {
        for (const af of allAttachFileEntries) {
          try {
            streamArchive.file(af.diskPath, { name: af.entryName });
          } catch {
          }
        }
        await new Promise((resolve, reject) => {
          if (streamOutput) streamOutput.on("close", resolve);
          streamArchive.on("error", reject);
          streamArchive.finalize();
        });
        if ((streamOutput == null ? void 0 : streamOutput.bytesWritten) === 0) {
          try {
            import_fs.default.unlinkSync(streamZipPath);
          } catch {
          }
          streamZipPath = "";
        }
      } catch (archErr) {
        await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", `\u6D41\u5F0FZIP\u5931\u8D25: ${archErr.message || ""}`);
        try {
          streamZipPath = "";
        } catch {
        }
      }
    }
    if (cancelled) {
      if (streamZipPath) {
        try {
          import_fs.default.unlinkSync(streamZipPath);
        } catch {
        }
      }
      for (const fp of outputFiles) {
        try {
          import_fs.default.unlinkSync(fp);
        } catch {
        }
      }
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88");
      await repo.update({ filterByTk: taskId, values: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } });
      return;
    }
    let mergedFilePath;
    if (isAllTables && streamZipPath && import_fs.default.existsSync(streamZipPath) && outputFiles.length === 0) {
      mergedFilePath = streamZipPath;
    } else if (outputFiles.length === 0) {
      throw new Error("\u6CA1\u6709\u6570\u636E\u53EF\u5BFC\u51FA");
    } else if (outputFiles.length === 1 && allAttachFileEntries.length === 0) {
      mergedFilePath = outputFiles[0];
    } else {
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", `\u6700\u7EC8\u5408\u5E76 ${outputFiles.length} \u4E2A\u6587\u4EF6${allAttachFileEntries.length > 0 ? " + " + allAttachFileEntries.length + " \u4E2A\u9644\u4EF6" : ""}...`);
      try {
        await db.sequelize.query("SET SESSION statement_timeout = 0");
      } catch {
      }
      const zipName = `sjgl02_export_${taskId}_${Date.now()}.tar.gz`;
      mergedFilePath = import_path.default.join(tempDir, zipName);
      const output = import_fs.default.createWriteStream(mergedFilePath);
      const archive = (0, import_archiver.default)("tar", { gzip: true, gzipOptions: { level: 1 } });
      await new Promise((resolve, reject) => {
        try {
          output.on("close", resolve);
          output.on("error", reject);
          archive.on("error", reject);
          archive.pipe(output);
          for (const fp of outputFiles) {
            archive.file(fp, { name: import_path.default.basename(fp) });
          }
          for (const af of allAttachFileEntries) {
            archive.file(af.diskPath, { name: af.entryName });
          }
          archive.finalize();
        } catch (err) {
          reject(err);
        }
      });
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", "\u6700\u7EC8\u5408\u5E76\u5B8C\u6210");
      for (const fp of outputFiles) {
        try {
          import_fs.default.unlinkSync(fp);
        } catch {
        }
      }
    }
    const d = /* @__PURE__ */ new Date();
    const padDate = (n) => String(n).padStart(2, "0");
    const dateStr = `${d.getFullYear()}${padDate(d.getMonth() + 1)}${padDate(d.getDate())}${padDate(d.getHours())}${padDate(d.getMinutes())}${padDate(d.getSeconds())}`;
    const isPkg = mergedFilePath.endsWith(".tar.gz");
    let finalDisplayName;
    if (tableName === "__all__") {
      finalDisplayName = isPkg ? `\u5168\u90E8\u6570\u636E\u8868_${dateStr}.tar.gz` : `\u5168\u90E8\u6570\u636E\u8868_${dateStr}.xlsx`;
    } else {
      const exportColl = db.getCollection(tableName);
      const collDisplayName = exportColl ? sanitizeSheetName(getCollDisplayName(exportColl, headerStyle)).replace(/\s+/g, "_") : tableName;
      finalDisplayName = `${collDisplayName}_${dateStr}${isPkg ? ".tar.gz" : ".xlsx"}`;
    }
    let finalFilePath = import_path.default.join(tempDir, finalDisplayName);
    let suffix = 0;
    while (import_fs.default.existsSync(finalFilePath)) {
      suffix++;
      finalFilePath = import_path.default.join(tempDir, finalDisplayName.replace(/\.(xlsx|tar\.gz)$/, `_${suffix}.${isPkg ? "tar.gz" : "xlsx"}`));
    }
    import_fs.default.renameSync(mergedFilePath, finalFilePath);
    mergedFilePath = finalFilePath;
    const stats = await import_promises.default.stat(mergedFilePath);
    const attachRepo = db.getRepository("attachments");
    const exportAttachment = await attachRepo.create({
      values: {
        title: import_path.default.basename(mergedFilePath),
        filename: import_path.default.basename(mergedFilePath),
        extname: import_path.default.extname(mergedFilePath),
        mimetype: mergedFilePath.endsWith(".tar.gz") ? "application/gzip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: stats.size,
        path: import_path.default.relative(storageDir, mergedFilePath).replace(/\\/g, "/")
      }
    });
    await repo.update({
      filterByTk: taskId,
      values: {
        status: "completed",
        progress: 100,
        processedRows,
        totalRows,
        exportFileId: exportAttachment.id,
        fileName: exportAttachment.filename || exportAttachment.title || "",
        completedAt: /* @__PURE__ */ new Date()
      }
    });
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", `\u5BFC\u51FA\u5B8C\u6210\uFF0C\u5171 ${processedRows} \u884C\u6570\u636E`);
  } catch (err) {
    try {
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", `\u5BFC\u51FA\u5931\u8D25: ${err.message || String(err)}`);
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u6587\u4EF6\u672A\u751F\u6210\uFF0C\u6570\u636E\u672A\u4FEE\u6539");
      await repo.update({
        filterByTk: taskId,
        values: {
          status: "failed",
          errorMessage: err.message || String(err),
          completedAt: /* @__PURE__ */ new Date()
        }
      });
    } catch {
    }
  } finally {
    import_cancel_state.cancelFlags.delete(taskId);
    release();
  }
}
async function getProgress(ctx, next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  ctx.body = {
    progress: task.progress,
    status: task.status,
    exportFileId: task.exportFileId
  };
  await next();
}
async function downloadExport(ctx, next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  if (!task.exportFileId) {
    ctx.throw(404, "Export file not found");
  }
  const attachRepo = ctx.db.getRepository("attachments");
  const attachment = await attachRepo.findOne({ filter: { id: task.exportFileId } });
  if (!attachment) {
    ctx.throw(404, "Attachment record not found");
  }
  const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
  const filePath = import_path.default.join(storageDir, attachment.path || attachment.filename);
  if (!import_fs.default.existsSync(filePath)) {
    ctx.throw(404, "File not found on disk");
  }
  const fileName = attachment.title || attachment.filename || "export.xlsx";
  ctx.attachment(encodeURIComponent(fileName));
  ctx.set("Content-Type", attachment.mimetype || "application/octet-stream");
  ctx.body = import_fs.default.createReadStream(filePath);
  await next();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  downloadExport,
  executeExport,
  getExportTableFields,
  getProgress,
  previewCount
});
