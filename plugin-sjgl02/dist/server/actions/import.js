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
var import_exports = {};
__export(import_exports, {
  executeImport: () => executeImport,
  getTableFields: () => getTableFields,
  preview: () => preview,
  uploadParse: () => uploadParse
});
module.exports = __toCommonJS(import_exports);
var import_exceljs = __toESM(require("exceljs"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_permission_check = require("./permission-check");
var import_taskLogs = require("./taskLogs");
var import_cancel_state = require("./cancel-state");
function quoteIdentifier(name) {
  const DQ = String.fromCharCode(34);
  const DDQ = DQ + DQ;
  return DQ + name.replace(new RegExp(DQ, "g"), DDQ) + DQ;
}
async function getPrimaryKeyColumns(sequelize, tableName) {
  try {
    const [rows] = await sequelize.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_name = :tableName
         AND tc.table_schema = current_schema()
       ORDER BY kcu.ordinal_position`,
      { replacements: { tableName }, raw: true }
    );
    return rows.map((r) => r.column_name);
  } catch {
    return [];
  }
}
async function prepareShadowPrimaryKey(sequelize, shadowTableName, pkColumns, transaction) {
  for (const pk of pkColumns) {
    await sequelize.query(
      "ALTER TABLE " + quoteIdentifier(shadowTableName) + " ALTER COLUMN " + quoteIdentifier(pk) + " DROP NOT NULL",
      { transaction }
    );
  }
}
function resolveMappedDataColumns(allColumns, mapping, coll, pkColumns) {
  var _a, _b;
  const mappedFieldSet = /* @__PURE__ */ new Set();
  for (const [fieldName, excelCol] of Object.entries(mapping)) {
    if (!excelCol || excelCol === "__ignore__") continue;
    let resolved = fieldName;
    try {
      for (const f of Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || [])) {
        if (f.name === fieldName && f.type === "belongsTo" && ((_b = f.options) == null ? void 0 : _b.foreignKey)) {
          resolved = f.options.foreignKey;
          break;
        }
      }
    } catch {
    }
    mappedFieldSet.add(resolved);
  }
  const autoPkSet = new Set(pkColumns);
  const result = allColumns.filter((c) => mappedFieldSet.has(c) || autoPkSet.has(c));
  return result;
}
function validateCollectionName(db, name) {
  const coll = db.getCollection(name);
  if (!coll) throw new Error("\u6570\u636E\u8868 " + name + " \u4E0D\u5B58\u5728");
  return coll;
}
function getAllowedFieldNames(coll) {
  var _a;
  const set = /* @__PURE__ */ new Set();
  try {
    for (const f of Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || [])) {
      set.add(f.name);
    }
  } catch {
  }
  return set;
}
function getFieldType(coll, name) {
  try {
    const f = coll.fields instanceof Map ? coll.fields.get(name) : null;
    return (f == null ? void 0 : f.type) || "string";
  } catch {
    return "string";
  }
}
function normalizeDateValue(val) {
  if (val === null || val === void 0 || val === "") return null;
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return val.getFullYear() + "-" + pad(val.getMonth() + 1) + "-" + pad(val.getDate()) + " " + pad(val.getHours()) + ":" + pad(val.getMinutes()) + ":" + pad(val.getSeconds());
  }
  if (typeof val === "number") {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + val * 864e5);
    if (!isNaN(d.getTime())) return normalizeDateValue(d);
  }
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return normalizeDateValue(d);
  }
  return null;
}
function convertValue(raw, fieldType) {
  if (raw === null || raw === void 0) return null;
  if (fieldType === "integer" || fieldType === "bigInt" || fieldType === "float" || fieldType === "double" || fieldType === "decimal" || fieldType === "number") {
    if (typeof raw === "number") return raw;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  if (fieldType === "boolean") {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      if (["true", "1", "yes", "\u662F"].includes(s)) return true;
      if (["false", "0", "no", "\u5426"].includes(s)) return false;
    }
    return null;
  }
  if (fieldType === "json" || fieldType === "array") {
    if (typeof raw === "object") return raw;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return fieldType === "array" ? raw.split(",").map((s) => s.trim()) : raw;
      }
    }
    return raw;
  }
  if (["date", "datetime", "datetimeTz", "unixTimestamp"].includes(fieldType)) {
    return normalizeDateValue(raw);
  }
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}
function convertRecordValues(record, coll) {
  const result = {};
  for (const [key, val] of Object.entries(record)) {
    if (val === void 0) continue;
    if (val === "") {
      const ft = getFieldType(coll, key);
      if (ft !== "string" && ft !== "text" && ft !== "password") {
        result[key] = null;
        continue;
      }
    }
    result[key] = convertValue(val, getFieldType(coll, key));
  }
  return result;
}
function applyBelongsToFK(record, headers, vals, mapping, coll) {
  var _a, _b;
  const belongs = [];
  try {
    belongs.push(...Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || []).filter((f) => f.type === "belongsTo"));
  } catch {
  }
  for (const bf of belongs) {
    const fk = ((_b = bf.options) == null ? void 0 : _b.foreignKey) || bf.name + "Id";
    const mappedVal = mapping[bf.name];
    if (mappedVal && mappedVal !== "__ignore__" && mappedVal !== "__custom__") {
      const colIdx = headers.indexOf(mappedVal);
      if (colIdx >= 0 && colIdx < vals.length) {
        record[fk] = vals[colIdx];
      }
      delete record[bf.name];
    }
  }
}
function makeRecord(vals, headers, mapping, customValues) {
  const record = {};
  for (const [tableField, excelCol] of Object.entries(mapping)) {
    if (!excelCol || excelCol === "__ignore__") continue;
    if (excelCol === "__custom__") {
      record[tableField] = customValues[tableField] ?? "";
      continue;
    }
    const colIndex = headers.indexOf(excelCol);
    if (colIndex >= 0 && colIndex < vals.length) {
      const raw = vals[colIndex];
      if (raw === void 0 || raw === null || raw === "") {
        record[tableField] = "";
        continue;
      }
      record[tableField] = raw;
    } else {
      record[tableField] = "";
    }
  }
  return record;
}
function buildSnapshot(vals, headers, mapping, customValues) {
  const snap = {};
  Object.entries(mapping).forEach(([fieldName, excelCol]) => {
    if (excelCol && excelCol !== "__ignore__") {
      if (excelCol === "__custom__") {
        snap[fieldName + "=(\u81EA\u5B9A\u4E49)"] = customValues[fieldName] || "";
      } else {
        const idx = headers.indexOf(excelCol);
        if (idx >= 0 && idx < vals.length) snap[excelCol + "\u2192" + fieldName] = String(vals[idx] ?? "");
      }
    }
  });
  return JSON.stringify(snap).substring(0, 500);
}
function isEmptyRow(vals, headers, mapping) {
  for (const excelCol of Object.values(mapping)) {
    if (!excelCol || excelCol === "__ignore__" || excelCol === "__custom__") continue;
    const idx = headers.indexOf(excelCol);
    if (idx >= 0 && idx < vals.length) {
      const v = vals[idx];
      if (v !== void 0 && v !== null && v !== "") return false;
    }
  }
  return true;
}
async function getTableFields(ctx, next) {
  var _a;
  const { tableName } = ctx.action.params;
  if (!tableName || tableName === "__all__") {
    ctx.body = [];
    await next();
    return;
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, "Table " + tableName + " not found");
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
  const fields = rawFields.filter((f) => {
    return f.name !== "createdBy" && f.name !== "updatedBy";
  }).map((f) => {
    var _a2, _b, _c, _d, _e;
    let title = ((_b = (_a2 = f.options) == null ? void 0 : _a2.uiSchema) == null ? void 0 : _b.title) || null;
    if (title && /^\{\{/.test(title)) title = null;
    if (!title) title = f.name;
    return {
      name: f.name,
      type: f.type,
      target: f.target || null,
      uiSchema: { ...((_c = f.options) == null ? void 0 : _c.uiSchema) || {}, title },
      interface: ((_d = f.options) == null ? void 0 : _d.interface) || null,
      isRequired: autoFields.includes(f.name) ? false : ((_e = f.options) == null ? void 0 : _e.allowNull) === false,
      isRelation: ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type),
      isForeignKey: fkSet.has(f.name)
    };
  });
  ctx.body = fields;
  await next();
}
function streamProcessExcel(filePath, targetSheet, headerRow, onRow, onHeader) {
  return new Promise((resolve, reject) => {
    const WorkbookReaderCtor = import_exceljs.default.stream.xlsx.WorkbookReader;
    const workbookReader = new WorkbookReaderCtor(filePath, {});
    let sheetFound = false;
    let ready = false;
    let headers = [];
    const hRowNum = headerRow || 1;
    let dataIndex = 0;
    let totalRows = 0;
    let destroyed = false;
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      try {
        workbookReader.destroy();
      } catch {
      }
    };
    workbookReader.on("worksheet", (worksheet) => {
      if (destroyed || sheetFound) return;
      if (targetSheet && worksheet.name !== targetSheet) return;
      sheetFound = true;
      worksheet.on("row", async (row) => {
        if (destroyed) return;
        const rowNum = row.number;
        if (rowNum < hRowNum) return;
        if (rowNum === hRowNum) {
          headers = (row.values || []).slice(1).map((h) => String(h ?? ""));
          ready = true;
          if (onHeader) onHeader(headers);
          return;
        }
        if (!ready) return;
        const vals = (row.values || []).slice(1);
        const empty = !vals.some((v) => v !== void 0 && v !== null && v !== "");
        if (empty) {
          dataIndex++;
          return;
        }
        totalRows++;
        try {
          const shouldContinue = await onRow(rowNum, dataIndex, vals);
          if (shouldContinue === false) destroy();
        } catch (err) {
          destroy();
          reject(err);
        }
        dataIndex++;
      });
      worksheet.on("end", () => {
        ready = true;
      });
    });
    workbookReader.on("end", () => resolve({ headers, totalRows }));
    workbookReader.on("error", (err) => {
      if (destroyed) resolve({ headers, totalRows });
      else reject(err);
    });
    workbookReader.read();
  });
}
async function uploadParse(ctx, next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { fileId, sheetName, headerRow } = params;
  if (!fileId) {
    ctx.throw(400, "fileId is required");
  }
  try {
    const attachRepo = ctx.db.getRepository("attachments");
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      ctx.throw(404, "File not found in storage");
    }
    const ext = (attachment.extname || "").toLowerCase().replace(".", "");
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      ctx.throw(400, "Unsupported format: " + ext + ". Only .xlsx, .xls, .csv allowed");
    }
    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
    const filePath = import_path.default.join(storageDir, attachment.path || attachment.filename);
    if (!import_fs.default.existsSync(filePath)) {
      ctx.throw(404, "File not found on disk");
    }
    const rawRows = [];
    let headerColumns = [];
    let totalRows = 0;
    let sheets = [sheetName || "Sheet1"];
    try {
      const wb = new import_exceljs.default.Workbook();
      await wb.xlsx.readFile(filePath);
      sheets = wb.worksheets.map((ws) => ws.name);
    } catch {
    }
    await streamProcessExcel(
      filePath,
      sheetName,
      parseInt(String(headerRow), 10) || 1,
      (rowNum, dataIdx, vals) => {
        if (dataIdx < 0) return true;
        if (dataIdx < 10) rawRows.push(vals);
        return dataIdx < 10;
      },
      (headers) => {
        headerColumns = headers;
      }
    ).then((result) => {
      if (headerColumns.length === 0) headerColumns = result.headers;
      totalRows = result.totalRows;
    });
    const previewRows = rawRows.map((vals) => {
      const obj = {};
      headerColumns.forEach((h, i) => {
        obj[h] = vals[i] !== void 0 ? vals[i] : "";
      });
      return obj;
    });
    ctx.body = {
      sheets,
      headerColumns,
      fileId,
      fileName: attachment.filename || attachment.title,
      previewRows,
      totalRows
    };
  } catch (err) {
    if (err.status) throw err;
    ctx.throw(500, "Failed to parse file: " + err.message);
  }
  await next();
}
async function preview(ctx, next) {
  var _a, _b, _c, _d, _e;
  const params = ctx.action.params.values || ctx.action.params;
  const fileId = params.fileId || ((_a = ctx.request.query) == null ? void 0 : _a.fileId) || ((_b = ctx.query) == null ? void 0 : _b.fileId);
  const sheetName = params.sheetName || ((_c = ctx.request.query) == null ? void 0 : _c.sheetName);
  const headerRow = params.headerRow || ((_d = ctx.request.query) == null ? void 0 : _d.headerRow);
  const previewLimit = parseInt(params.previewLimit || ((_e = ctx.request.query) == null ? void 0 : _e.previewLimit) || "10", 10) || 10;
  if (!fileId) {
    ctx.throw(400, "fileId is required");
  }
  try {
    const attachRepo = ctx.db.getRepository("attachments");
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      ctx.throw(404, "Uploaded file not found in storage");
    }
    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
    const filePath = import_path.default.join(storageDir, attachment.path || attachment.filename);
    if (!import_fs.default.existsSync(filePath)) {
      ctx.throw(404, "File not found on disk: " + filePath);
    }
    const rawRows = [];
    let columns = [];
    let totalRows = 0;
    const hRow = parseInt(String(headerRow), 10) || 1;
    await streamProcessExcel(
      filePath,
      sheetName,
      hRow,
      (rowNum, dataIdx, vals) => {
        if (dataIdx < 0) return true;
        if (dataIdx < previewLimit) rawRows.push(vals);
        return dataIdx < previewLimit;
      },
      (headers) => {
        columns = headers;
      }
    ).then((result) => {
      if (columns.length === 0) columns = result.headers;
      totalRows = result.totalRows;
    });
    const previewRows = rawRows.map((vals) => {
      const obj = {};
      columns.forEach((h, i) => {
        obj[h] = vals[i] !== void 0 ? vals[i] : "";
      });
      return obj;
    });
    ctx.body = {
      preview: previewRows,
      totalRows,
      columns
    };
  } catch (err) {
    if (err.status) throw err;
    ctx.throw(500, "Failed to preview file: " + err.message);
  }
  await next();
}
async function executeImport(ctx, next) {
  var _a;
  const params = ctx.action.params.values || ctx.action.params;
  const {
    tableName,
    fileId,
    sheetName,
    headerRow,
    fieldMapping,
    customValues,
    importMode,
    uniqueFields,
    blankCellMode,
    permSource
  } = params;
  if (!tableName || !fileId) {
    ctx.throw(400, "tableName and fileId are required");
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, "Table " + tableName + " not found");
  }
  const perm = await (0, import_permission_check.checkImportPermission)(ctx, tableName, permSource);
  if (perm.importMode.length > 0 && !perm.importMode.includes(importMode)) {
    ctx.throw(
      403,
      "\u60A8\u7684\u6743\u9650\u4E0D\u5141\u8BB8\u4F7F\u7528\u300C" + importMode + "\u300D\u6A21\u5F0F\u5BFC\u5165\u6570\u636E\u8868\u300C" + tableName + "\u300D\uFF0C\u5141\u8BB8\u7684\u6A21\u5F0F\uFF1A" + perm.importMode.join("\u3001")
    );
  }
  const allowedImportFields = perm.importFields || [];
  if (allowedImportFields.length > 0 && fieldMapping) {
    for (const tableField of Object.keys(fieldMapping)) {
      if (!allowedImportFields.includes(tableField)) {
        ctx.throw(403, "\u60A8\u7684\u6743\u9650\u4E0D\u5141\u8BB8\u5BFC\u5165\u5B57\u6BB5\u300C" + tableField + "\u300D\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458");
      }
    }
  }
  const requiredPermFields = perm.requiredFields || [];
  if (requiredPermFields.length > 0 && fieldMapping) {
    for (const rf of requiredPermFields) {
      const mappedTo = fieldMapping[rf];
      if (!mappedTo || mappedTo === "__ignore__") {
        ctx.throw(400, "\u5FC5\u586B\u5B57\u6BB5\u300C" + rf + "\u300D\u672A\u5728\u5B57\u6BB5\u6620\u5C04\u4E2D\u914D\u7F6E");
      }
    }
  }
  const attachRepo = ctx.db.getRepository("attachments");
  const attachment = await attachRepo.findOne({ filter: { id: fileId } });
  if (!attachment) {
    ctx.throw(404, "Uploaded file not found");
  }
  const ext = (attachment.extname || "").toLowerCase().replace(".", "");
  if (!["xlsx", "xls", "csv"].includes(ext)) {
    ctx.throw(400, "Unsupported file format. Only .xlsx, .xls, .csv allowed");
  }
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.create({
    values: {
      taskType: "import",
      tableName,
      status: "pending",
      fieldMapping: fieldMapping || {},
      customValues: customValues || {},
      importMode: importMode || "insert",
      sheetName: sheetName || "Sheet1",
      headerRow: headerRow || 1,
      importFileId: fileId,
      fileName: attachment.filename || attachment.title || "",
      uniqueFields: uniqueFields || [],
      totalRows: 0,
      progress: 0,
      createdById: (_a = ctx.state.currentUser) == null ? void 0 : _a.id,
      blankCellMode: blankCellMode || "update"
    }
  });
  const db = ctx.db;
  const taskId = task.id;
  ctx.body = { taskId };
  await next();
  setImmediate(() => {
    processImportAsync(db, taskId, {
      tableName,
      fileId,
      sheetName,
      headerRow,
      fieldMapping,
      customValues,
      importMode,
      uniqueFields,
      blankCellMode,
      attachmentPath: attachment.path || attachment.filename
    });
  });
}
async function processImportAsync(db, taskId, params) {
  const {
    tableName,
    sheetName,
    headerRow,
    fieldMapping,
    customValues,
    importMode,
    uniqueFields,
    blankCellMode,
    attachmentPath
  } = params;
  const repo = db.getRepository("sjgl02_tasks");
  const sequelize = db.sequelize;
  let userId = null;
  try {
    const taskRec = await repo.findOne({ filter: { id: taskId }, raw: true });
    userId = (taskRec == null ? void 0 : taskRec.createdById) || null;
  } catch {
  }
  const mapping = fieldMapping || {};
  const custVals = customValues || {};
  const uFields = uniqueFields || [];
  const hRow = parseInt(String(headerRow), 10) || 1;
  const bCellMode = blankCellMode || "update";
  const mode = importMode || "insert";
  let coll;
  try {
    coll = validateCollectionName(db, tableName);
  } catch (err) {
    await fail(taskId, db, "\u6570\u636E\u8868\u4E0D\u5B58\u5728: " + err.message);
    return;
  }
  const allowedFieldSet = getAllowedFieldNames(coll);
  for (const key of Object.keys(mapping)) {
    if (!allowedFieldSet.has(key)) {
      await fail(taskId, db, "\u5B57\u6BB5 " + key + " \u4E0D\u5B58\u5728\u4E8E\u6570\u636E\u8868 " + tableName);
      return;
    }
  }
  for (const uf of uFields) {
    if (!allowedFieldSet.has(uf)) {
      await fail(taskId, db, "\u552F\u4E00\u503C\u5B57\u6BB5 " + uf + " \u4E0D\u5B58\u5728");
      return;
    }
  }
  const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
  const filePath = import_path.default.join(storageDir, attachmentPath);
  if (!import_fs.default.existsSync(filePath)) {
    await fail(taskId, db, "\u6587\u4EF6\u672A\u627E\u5230: " + filePath);
    return;
  }
  let shadowTableName = "";
  let errorLogs = [];
  let phase1TotalRows = 0;
  let phase1Headers = [];
  let phase2TotalRows = 0;
  try {
    await repo.update({ filterByTk: taskId, values: { status: "processing" } });
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u5F00\u59CB\u6267\u884C\u5BFC\u5165\u4EFB\u52A1");
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u76EE\u6807\u6570\u636E\u8868: " + tableName);
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u5BFC\u5165\u6A21\u5F0F: " + mode);
    const pkColumns = await getPrimaryKeyColumns(sequelize, tableName);
    if (pkColumns.length === 0) {
      throw new Error("\u6570\u636E\u8868 " + tableName + " \u6CA1\u6709\u4E3B\u952E\uFF0C\u65E0\u6CD5\u5BFC\u5165");
    }
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E00\uFF1A\u6D41\u5F0F\u9884\u6821\u9A8C\u5F00\u59CB...");
    errorLogs = [];
    const seenUniqueValues = /* @__PURE__ */ new Set();
    const seenPkValues = /* @__PURE__ */ new Set();
    let phase1Cancelled = false;
    const phase1Result = await new Promise(
      (resolve, reject) => {
        streamProcessExcel(
          filePath,
          sheetName,
          hRow,
          (rowNum, dataIdx, vals) => {
            if (import_cancel_state.cancelFlags.has(taskId)) {
              phase1Cancelled = true;
              return false;
            }
            if (dataIdx < 0) return true;
            if (isEmptyRow(vals, phase1Headers, mapping)) return true;
            const record = makeRecord(vals, phase1Headers, mapping, custVals);
            if ((mode === "update" || mode === "upsert") && uFields.length > 0) {
              const emptyUFields = uFields.filter(
                (uf) => record[uf] === void 0 || record[uf] === "" || record[uf] === null
              );
              if (emptyUFields.length > 0) {
                if (errorLogs.length < 1e3) {
                  errorLogs.push({
                    row: dataIdx + 1,
                    excelRow: rowNum,
                    reason: "\u552F\u4E00\u503C\u5B57\u6BB5\u4E3A\u7A7A\uFF08" + emptyUFields.join(", ") + "\uFF09",
                    snapshot: buildSnapshot(vals, phase1Headers, mapping, custVals)
                  });
                }
              } else {
                const ufKey = uFields.map((uf) => record[uf]).join("||");
                if (seenUniqueValues.has(ufKey)) {
                  if (errorLogs.length < 1e3) {
                    errorLogs.push({
                      row: dataIdx + 1,
                      excelRow: rowNum,
                      reason: "Excel \u5185\u90E8\u552F\u4E00\u503C\u91CD\u590D: " + uFields.join("+") + " = " + ufKey,
                      snapshot: buildSnapshot(vals, phase1Headers, mapping, custVals)
                    });
                  }
                } else {
                  seenUniqueValues.add(ufKey);
                }
              }
            }
            for (const pk of pkColumns) {
              if (mapping[pk] && mapping[pk] !== "__ignore__") {
                const pkVal = record[pk];
                if (pkVal !== void 0 && pkVal !== "" && pkVal !== null) {
                  const pkKey = String(pkVal);
                  if (seenPkValues.has(pkKey)) {
                    if (errorLogs.length < 1e3) {
                      errorLogs.push({
                        row: dataIdx + 1,
                        excelRow: rowNum,
                        reason: "Excel \u5185\u90E8\u4E3B\u952E\u91CD\u590D: " + pk + " = " + pkKey,
                        snapshot: buildSnapshot(vals, phase1Headers, mapping, custVals)
                      });
                    }
                  } else {
                    seenPkValues.add(pkKey);
                  }
                }
              }
            }
            return true;
          },
          (headers) => {
            phase1Headers = headers;
          }
        ).then((result) => {
          resolve({
            passed: !phase1Cancelled && errorLogs.length === 0,
            headers: result.headers,
            totalRows: result.totalRows
          });
        }).catch(reject);
      }
    );
    phase1Headers = phase1Result.headers;
    phase1TotalRows = phase1Result.totalRows;
    if (phase1Cancelled) {
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF08\u9636\u6BB5\u4E00\uFF09");
      import_cancel_state.cancelFlags.delete(taskId);
      await repo.update({ filterByTk: taskId, values: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } });
      return;
    }
    await repo.update({ filterByTk: taskId, values: { totalRows: phase1TotalRows } });
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", "\u9636\u6BB5\u4E00\u9884\u6821\u9A8C\u5B8C\u6210\uFF0C\u5171 " + phase1TotalRows + " \u884C\u6709\u6548\u6570\u636E");
    if (!phase1Result.passed) {
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", "\u9636\u6BB5\u4E00\u9884\u6821\u9A8C\u5931\u8D25\uFF0C\u5171 " + errorLogs.length + " \u4E2A\u9519\u8BEF");
      await repo.update({
        filterByTk: taskId,
        values: {
          status: "failed",
          errorLogs,
          errorMessage: "\u9884\u6821\u9A8C\u5931\u8D25: " + errorLogs.length + " \u4E2A\u9519\u8BEF",
          completedAt: /* @__PURE__ */ new Date()
        }
      });
      return;
    }
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E8C\uFF1A\u5F71\u5B50\u8868\u5199\u5165\u5F00\u59CB...");
    shadowTableName = "_sjgl02_import_" + taskId;
    const quotedMain = quoteIdentifier(tableName);
    const quotedShadow = quoteIdentifier(shadowTableName);
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(
        "CREATE TABLE " + quotedShadow + " ( LIKE " + quotedMain + " INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS )",
        { transaction }
      );
      const [colRows] = await sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = :shadowTable AND table_schema = current_schema() ORDER BY ordinal_position",
        { replacements: { shadowTable: shadowTableName }, raw: true, transaction }
      );
      const allColumns = colRows.map((r) => r.column_name);
      await prepareShadowPrimaryKey(sequelize, shadowTableName, pkColumns, transaction);
      await sequelize.query("ALTER TABLE " + quotedShadow + " ADD COLUMN __import_row_id__ BIGSERIAL PRIMARY KEY", {
        transaction
      });
      const dataColumns = resolveMappedDataColumns(allColumns, mapping, coll, pkColumns);
      if (dataColumns.length === 0) {
        throw new Error("\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u5B57\u6BB5");
      }
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u5F71\u5B50\u8868\u5217: " + dataColumns.join(", ") + "\uFF0C\u4E3B\u952E: " + pkColumns.join(", "));
      const BATCH_SIZE = Math.max(1, Math.min(2e3, Math.floor(3e4 / dataColumns.length)));
      const quotedCols = dataColumns.map((c) => quoteIdentifier(c)).join(", ");
      let batch = [];
      let phase2Processed = 0;
      let phase2Cancelled = false;
      const phase2ErrorLogs = [];
      const flushBatch = async () => {
        if (batch.length === 0) return;
        try {
          await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, batch, transaction);
        } catch (batchErr) {
          await (0, import_taskLogs.writeTaskLog)(
            db,
            taskId,
            "WARN",
            "\u6279\u6B21\u5199\u5165\u5931\u8D25\uFF1A" + (batchErr.message || String(batchErr)) + "\uFF0C\u9010\u884C\u5B9A\u4F4D..."
          );
          const splitLogs = await insertWithSplit(
            sequelize,
            quotedShadow,
            quotedCols,
            dataColumns,
            batch,
            phase2Processed - batch.length,
            transaction
          );
          if (splitLogs.length > 0) {
            phase2ErrorLogs.push(...splitLogs);
            if (phase2ErrorLogs.length > 1e3) phase2ErrorLogs.splice(1e3);
            throw new Error(splitLogs.length + " \u884C\u5199\u5165\u5931\u8D25");
          }
        }
        batch = [];
      };
      await new Promise((resolve, reject) => {
        streamProcessExcel(
          filePath,
          sheetName,
          hRow,
          async (rowNum, dataIdx, vals) => {
            if (import_cancel_state.cancelFlags.has(taskId)) {
              phase2Cancelled = true;
              return false;
            }
            if (dataIdx < 0) return true;
            if (isEmptyRow(vals, phase1Headers, mapping)) return true;
            const record = makeRecord(vals, phase1Headers, mapping, custVals);
            applyBelongsToFK(record, phase1Headers, vals, mapping, coll);
            const converted = convertRecordValues(record, coll);
            const rowVals = dataColumns.map((c) => converted[c] !== void 0 ? converted[c] : null);
            batch.push(rowVals);
            phase2Processed++;
            if (batch.length >= BATCH_SIZE) {
              try {
                await flushBatch();
              } catch (e) {
                reject(e);
                return false;
              }
              const prog = 50 + Math.floor(phase2Processed / Math.max(phase1TotalRows, 1) * 40);
              try {
                await repo.update({
                  filterByTk: taskId,
                  values: { progress: Math.min(90, prog), processedRows: phase2Processed }
                });
              } catch {
              }
            }
            if (phase2Processed % 1e3 === 0 && import_cancel_state.cancelFlags.has(taskId)) {
              phase2Cancelled = true;
              return false;
            }
            return true;
          },
          (headers) => {
            if (phase1Headers.length === 0) phase1Headers = headers;
          }
        ).then(async () => {
          try {
            await flushBatch();
            resolve();
          } catch (e) {
            reject(e);
          }
        }).catch(reject);
      });
      if (phase2Cancelled || import_cancel_state.cancelFlags.has(taskId)) {
        await sequelize.query("DROP TABLE IF EXISTS " + quotedShadow, { transaction });
        await transaction.commit();
        import_cancel_state.cancelFlags.delete(taskId);
        await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF08\u9636\u6BB5\u4E8C\uFF09");
        await repo.update({ filterByTk: taskId, values: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } });
        return;
      }
      if (phase2ErrorLogs.length > 0) {
        await sequelize.query("DROP TABLE IF EXISTS " + quotedShadow, { transaction });
        await transaction.commit();
        errorLogs = phase2ErrorLogs;
        for (let i = 0; i < Math.min(10, phase2ErrorLogs.length); i++) {
          const log = phase2ErrorLogs[i];
          await (0, import_taskLogs.writeTaskLog)(
            db,
            taskId,
            "ERROR",
            "\u7B2C " + (log.row || i + 1) + " \u884C\u5199\u5165\u5931\u8D25\uFF1A" + log.reason + "\uFF0C\u5FEB\u7167\uFF1A" + (log.snapshot || "{}")
          );
        }
        await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", "\u9636\u6BB5\u4E8C\u5199\u5165\u5931\u8D25\uFF0C\u5171 " + errorLogs.length + " \u4E2A\u9519\u8BEF");
        await repo.update({
          filterByTk: taskId,
          values: {
            status: "failed",
            errorLogs,
            errorMessage: "\u9636\u6BB5\u4E8C\u5199\u5165\u5931\u8D25: " + errorLogs.length + " \u884C\u6570\u636E\u5F02\u5E38",
            completedAt: /* @__PURE__ */ new Date()
          }
        });
        return;
      }
      phase2TotalRows = phase2Processed;
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", "\u9636\u6BB5\u4E8C\u5F71\u5B50\u8868\u5199\u5165\u5B8C\u6210\uFF0C\u5171 " + phase2TotalRows + " \u884C");
      await repo.update({ filterByTk: taskId, values: { progress: 90, processedRows: phase2TotalRows } });
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E09\uFF1A\u539F\u5B50\u8FC1\u79FB\u5F00\u59CB...");
      try {
        await sequelize.query("SET LOCAL statement_timeout = '30min'", { transaction });
      } catch {
      }
      const targetRepo = db.getRepository(tableName);
      const PHASE3_BATCH_SIZE = 5e3;
      const buildRecordFromShadow = (row) => {
        const rec = {};
        for (const col of dataColumns) {
          rec[col] = row[col];
        }
        for (const pk of pkColumns) {
          if (!mapping[pk] || mapping[pk] === "__ignore__") {
            delete rec[pk];
          } else if (rec[pk] === null || rec[pk] === "" || rec[pk] === void 0) {
            delete rec[pk];
          }
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (allColumns.includes("createdById") && !dataColumns.includes("createdById") && userId) {
          rec.createdById = userId;
        }
        if (allColumns.includes("updatedById") && !dataColumns.includes("updatedById") && userId) {
          rec.updatedById = userId;
        }
        if (allColumns.includes("createdAt") && !dataColumns.includes("createdAt")) {
          rec.createdAt = now;
        }
        if (allColumns.includes("updatedAt") && !dataColumns.includes("updatedAt")) {
          rec.updatedAt = now;
        }
        return rec;
      };
      const fixCreatedSystemFields = async (instances, sourceRows, options) => {
        if (instances.length === 0 || sourceRows.length === 0) return;
        const sysFields = [];
        if (allColumns.includes("createdById")) sysFields.push("createdById");
        if (allColumns.includes("updatedById")) sysFields.push("updatedById");
        if (allColumns.includes("createdAt")) sysFields.push("createdAt");
        if (allColumns.includes("updatedAt")) sysFields.push("updatedAt");
        if (sysFields.length === 0) return;
        const pkAttr = pkColumns[0] || "id";
        const valueRows = [];
        const replacements = {};
        for (let i = 0; i < instances.length; i++) {
          const inst = instances[i];
          const row = sourceRows[i];
          const id = inst.get(pkAttr);
          valueRows.push(`(:id${i}, :cb${i}, :ub${i}, :cat${i}, :uat${i})`);
          replacements[`id${i}`] = id;
          replacements[`cb${i}`] = dataColumns.includes("createdById") ? row.createdById : userId;
          replacements[`ub${i}`] = dataColumns.includes("updatedById") ? row.updatedById : userId;
          replacements[`cat${i}`] = dataColumns.includes("createdAt") ? row.createdAt : null;
          replacements[`uat${i}`] = dataColumns.includes("updatedAt") ? row.updatedAt : null;
        }
        const setClauses = [];
        if (allColumns.includes("createdById")) {
          setClauses.push(`${quoteIdentifier("createdById")} = v.${quoteIdentifier("createdById")}::bigint`);
        }
        if (allColumns.includes("updatedById")) {
          setClauses.push(`${quoteIdentifier("updatedById")} = v.${quoteIdentifier("updatedById")}::bigint`);
        }
        if (allColumns.includes("createdAt")) {
          setClauses.push(
            `${quoteIdentifier("createdAt")} = COALESCE(v.${quoteIdentifier(
              "createdAt"
            )}::timestamp with time zone, m.${quoteIdentifier("createdAt")})`
          );
        }
        if (allColumns.includes("updatedAt")) {
          setClauses.push(
            `${quoteIdentifier("updatedAt")} = COALESCE(v.${quoteIdentifier(
              "updatedAt"
            )}::timestamp with time zone, m.${quoteIdentifier("updatedAt")})`
          );
        }
        const sql = `
          UPDATE ${quoteIdentifier(tableName)} AS m
          SET ${setClauses.join(", ")}
          FROM (VALUES ${valueRows.join(", ")})
          AS v(${quoteIdentifier(pkAttr)}, ${sysFields.map((f) => quoteIdentifier(f)).join(", ")})
          WHERE m.${quoteIdentifier(pkAttr)} = v.${quoteIdentifier(pkAttr)}
        `;
        await sequelize.query(sql, { replacements, transaction: options.transaction });
      };
      const readShadowBatch = async (lastRowId) => {
        const [rows] = await sequelize.query(
          "SELECT " + dataColumns.map((c) => quoteIdentifier(c)).join(", ") + ", __import_row_id__ FROM " + quotedShadow + " WHERE __import_row_id__ > :lastRowId ORDER BY __import_row_id__ LIMIT :limit",
          { replacements: { lastRowId, limit: PHASE3_BATCH_SIZE }, raw: true, transaction }
        );
        return rows;
      };
      const checkPkConflicts = async () => {
        const mappedPkColumns = pkColumns.filter((pk) => mapping[pk] && mapping[pk] !== "__ignore__");
        if (mappedPkColumns.length === 0) return;
        const pkNullChecks = mappedPkColumns.map((pk) => "s." + quoteIdentifier(pk) + " IS NOT NULL").join(" AND ");
        const pkMatchChecks = mappedPkColumns.map((pk) => "m." + quoteIdentifier(pk) + " = s." + quoteIdentifier(pk)).join(" AND ");
        const [conflicts] = await sequelize.query(
          "SELECT " + mappedPkColumns.map((c) => "m." + quoteIdentifier(c)).join(", ") + " FROM " + quotedMain + " m WHERE EXISTS (SELECT 1 FROM " + quotedShadow + " s WHERE " + pkMatchChecks + " AND " + pkNullChecks + ") LIMIT 1",
          { raw: true, transaction }
        );
        if (conflicts.length > 0) {
          const sample = conflicts[0];
          const sampleKey = mappedPkColumns.map((pk) => pk + "=" + sample[pk]).join(", ");
          throw new Error("\u4E3B\u952E\u503C\u4E0E\u6570\u636E\u5E93\u5DF2\u6709\u8BB0\u5F55\u51B2\u7A81\uFF08" + sampleKey + "\uFF09");
        }
      };
      let processedCount = 0;
      let updatedCount = 0;
      if (mode === "update") {
        const setCols = dataColumns.filter((c) => !pkColumns.includes(c));
        const setClauses = [];
        for (const col of setCols) {
          if (bCellMode === "skip") {
            setClauses.push(
              quoteIdentifier(col) + " = COALESCE(s." + quoteIdentifier(col) + ", m." + quoteIdentifier(col) + ")"
            );
          } else {
            setClauses.push(quoteIdentifier(col) + " = s." + quoteIdentifier(col));
          }
        }
        for (const f of ["updatedAt", "updatedById"]) {
          if (allColumns.includes(f) && !dataColumns.includes(f)) {
            setClauses.push(
              quoteIdentifier(f) + " = " + (f === "updatedAt" ? "NOW()" : (userId || "NULL") + "::bigint")
            );
          }
        }
        const whereClauses = uFields.map((uf) => "m." + quoteIdentifier(uf) + " = s." + quoteIdentifier(uf)).join(" AND ");
        if (setClauses.length === 0 || !whereClauses) {
          throw new Error("\u66F4\u65B0\u6A21\u5F0F\u7F3A\u5C11\u53EF\u66F4\u65B0\u5B57\u6BB5\u6216\u552F\u4E00\u503C\u5B57\u6BB5");
        }
        let lastRowId = 0;
        let batchRows = await readShadowBatch(lastRowId);
        while (batchRows.length > 0) {
          if (import_cancel_state.cancelFlags.has(taskId)) throw new Error("\u4EFB\u52A1\u5DF2\u53D6\u6D88");
          const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;
          const [result] = await sequelize.query(
            "UPDATE " + quotedMain + " m SET " + setClauses.join(", ") + " FROM " + quotedShadow + " s WHERE " + whereClauses + " AND s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId RETURNING m.id",
            { replacements: { lastRowId, maxRowId }, transaction }
          );
          updatedCount += result.length;
          processedCount += batchRows.length;
          lastRowId = maxRowId;
          const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
          try {
            await repo.update({
              filterByTk: taskId,
              values: { progress: Math.min(98, prog), processedRows: processedCount }
            });
          } catch {
          }
          batchRows = await readShadowBatch(lastRowId);
        }
      } else {
        if (mode === "insert") {
          await checkPkConflicts();
        }
        let lastRowId = 0;
        let batchRows = await readShadowBatch(lastRowId);
        while (batchRows.length > 0) {
          if (import_cancel_state.cancelFlags.has(taskId)) throw new Error("\u4EFB\u52A1\u5DF2\u53D6\u6D88");
          const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;
          if (mode === "upsert") {
            const setCols = dataColumns.filter((c) => !uFields.includes(c) && !pkColumns.includes(c));
            const setClauses = [];
            for (const col of setCols) {
              if (bCellMode === "skip") {
                setClauses.push(
                  quoteIdentifier(col) + " = COALESCE(s." + quoteIdentifier(col) + ", m." + quoteIdentifier(col) + ")"
                );
              } else {
                setClauses.push(quoteIdentifier(col) + " = s." + quoteIdentifier(col));
              }
            }
            for (const f of ["updatedAt", "updatedById"]) {
              if (allColumns.includes(f) && !dataColumns.includes(f)) {
                setClauses.push(
                  quoteIdentifier(f) + " = " + (f === "updatedAt" ? "NOW()" : (userId || "NULL") + "::bigint")
                );
              }
            }
            const whereClauses = uFields.map((uf) => "m." + quoteIdentifier(uf) + " = s." + quoteIdentifier(uf)).join(" AND ");
            if (uFields.length > 0 && setClauses.length > 0) {
              const [updateResult] = await sequelize.query(
                "UPDATE " + quotedMain + " m SET " + setClauses.join(", ") + " FROM " + quotedShadow + " s WHERE " + whereClauses + " AND s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId RETURNING m.id",
                { replacements: { lastRowId, maxRowId }, transaction }
              );
              updatedCount += updateResult.length;
            }
            const [newRows] = await sequelize.query(
              "SELECT s.* FROM " + quotedShadow + " s WHERE s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId" + (uFields.length > 0 ? " AND NOT EXISTS (SELECT 1 FROM " + quotedMain + " m WHERE " + uFields.map((uf) => "m." + quoteIdentifier(uf) + " = s." + quoteIdentifier(uf)).join(" AND ") + ")" : ""),
              { replacements: { lastRowId, maxRowId }, raw: true, transaction }
            );
            const records = newRows.map(buildRecordFromShadow);
            if (records.length > 0) {
              const instances = await targetRepo.create({
                values: records,
                transaction,
                context: { state: { currentUser: { id: userId } } }
              });
              await fixCreatedSystemFields(instances, newRows, { transaction });
            }
            processedCount += batchRows.length;
          } else {
            const records = batchRows.map(buildRecordFromShadow);
            const instances = await targetRepo.create({
              values: records,
              transaction,
              context: { state: { currentUser: { id: userId } } }
            });
            await fixCreatedSystemFields(instances, batchRows, { transaction });
            processedCount += batchRows.length;
          }
          lastRowId = maxRowId;
          const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
          try {
            await repo.update({
              filterByTk: taskId,
              values: { progress: Math.min(98, prog), processedRows: processedCount }
            });
          } catch {
          }
          batchRows = await readShadowBatch(lastRowId);
        }
      }
      await sequelize.query("DROP TABLE IF EXISTS " + quotedShadow, { transaction });
      await transaction.commit();
      const successMsg = mode === "update" ? "\u8FC1\u79FB\u5B8C\u6210\uFF0C\u66F4\u65B0 " + updatedCount + " \u884C\uFF0C\u5F71\u5B50\u8868\u5DF2\u5220\u9664" : mode === "upsert" ? "\u8FC1\u79FB\u5B8C\u6210\uFF0C\u66F4\u65B0 " + updatedCount + " \u884C\uFF0C\u65B0\u589E " + (processedCount - updatedCount) + " \u884C\uFF0C\u5F71\u5B50\u8868\u5DF2\u5220\u9664" : "\u8FC1\u79FB\u5B8C\u6210\uFF0C\u5171 " + processedCount + " \u884C\uFF0C\u5F71\u5B50\u8868\u5DF2\u5220\u9664";
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", successMsg);
      await repo.update({
        filterByTk: taskId,
        values: { status: "completed", progress: 100, processedRows: processedCount, completedAt: /* @__PURE__ */ new Date() }
      });
    } catch (phaseErr) {
      try {
        await transaction.rollback();
      } catch {
      }
      try {
        await sequelize.query("DROP TABLE IF EXISTS " + quotedShadow);
      } catch {
      }
      throw phaseErr;
    }
  } catch (err) {
    try {
      const fallbackLogs = errorLogs.length > 0 ? errorLogs : [
        {
          reason: err.message || String(err),
          snapshot: "shadowTable=" + (shadowTableName || "?") + ", mode=" + mode + ", phase=\u9636\u6BB5\u4E09"
        }
      ];
      await (0, import_taskLogs.writeTaskLog)(
        db,
        taskId,
        "ERROR",
        "\u5BFC\u5165\u5931\u8D25(" + mode + "\u6A21\u5F0F, \u8868" + tableName + "): " + (err.message || String(err))
      );
      await repo.update({
        filterByTk: taskId,
        values: {
          status: "failed",
          errorMessage: err.message || String(err),
          errorLogs: fallbackLogs,
          completedAt: /* @__PURE__ */ new Date()
        }
      });
    } catch {
    }
  } finally {
    import_cancel_state.cancelFlags.delete(taskId);
  }
}
async function insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, batch, transaction) {
  const placeholders = batch.map((_, ri) => "(" + dataColumns.map((__, ci) => "$" + (ri * dataColumns.length + ci + 1)).join(", ") + ")").join(", ");
  const flatValues = batch.flat();
  await sequelize.query("INSERT INTO " + quotedShadow + " (" + quotedCols + ") VALUES " + placeholders, {
    bind: flatValues,
    transaction
  });
}
async function insertWithSplit(sequelize, quotedShadow, quotedCols, dataColumns, batch, startOffset, transaction) {
  const errLogs = [];
  const SUB_SIZE = Math.max(1, Math.floor(batch.length / 10));
  if (SUB_SIZE === 1) {
    for (let si = 0; si < batch.length; si++) {
      try {
        await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, [batch[si]], transaction);
      } catch (e) {
        errLogs.push({
          row: startOffset + si + 1,
          excelRow: 0,
          reason: e.message || String(e),
          snapshot: JSON.stringify(
            dataColumns.reduce((acc, c, i) => {
              acc[c] = batch[si][i];
              return acc;
            }, {})
          ).substring(0, 500)
        });
      }
    }
  } else {
    for (let si = 0; si < batch.length; si += SUB_SIZE) {
      const sub = batch.slice(si, si + SUB_SIZE);
      try {
        await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, sub, transaction);
      } catch {
        const subLogs = await insertWithSplit(
          sequelize,
          quotedShadow,
          quotedCols,
          dataColumns,
          sub,
          startOffset + si,
          transaction
        );
        errLogs.push(...subLogs);
        if (errLogs.length > 100) break;
      }
    }
  }
  return errLogs;
}
async function fail(taskId, db, message) {
  try {
    const repo = db.getRepository("sjgl02_tasks");
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", message);
    await repo.update({
      filterByTk: taskId,
      values: { status: "failed", errorMessage: message, completedAt: /* @__PURE__ */ new Date() }
    });
  } catch {
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  executeImport,
  getTableFields,
  preview,
  uploadParse
});
