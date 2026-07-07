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
var import_actions_exports = {};
__export(import_actions_exports, {
  autoMatch: () => autoMatch,
  executeImport: () => executeImport,
  getTableFields: () => getTableFields,
  preview: () => preview,
  uploadParse: () => uploadParse
});
module.exports = __toCommonJS(import_actions_exports);
var import_fs = __toESM(require("fs"));
var import_exceljs = __toESM(require("exceljs"));
var import_import_utils = require("./import-utils");
var import_excel_parser = require("./excel-parser");
var import_permission_check = require("./permission-check");
var import_permission_service = require("../services/permission-service");
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
async function autoMatch(ctx, next) {
  var _a;
  const params = ctx.action.params.values || ctx.action.params;
  const { tableName, excelHeaders } = params;
  if (!tableName) {
    ctx.throw(400, "tableName is required");
  }
  if (!excelHeaders || !Array.isArray(excelHeaders)) {
    ctx.throw(400, "excelHeaders must be a non-empty array");
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, "\u6570\u636E\u8868 " + tableName + " \u4E0D\u5B58\u5728");
  }
  const rawFields = [];
  try {
    rawFields.push(...Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || []));
  } catch {
  }
  const fieldNames = rawFields.map((f) => f.name);
  const fieldNameLowerSet = new Set(fieldNames.map((n) => n.toLowerCase()));
  const currentUser = ctx.state.currentUser;
  let allowedFields = null;
  if (currentUser) {
    try {
      const permService = new import_permission_service.PermissionService(ctx.db);
      const perm = await permService.checkPermission(currentUser.id, tableName, "import");
      if (perm.importFields && perm.importFields.length > 0) {
        allowedFields = new Set(perm.importFields);
      }
    } catch {
    }
  }
  const mapping = {};
  for (const header of excelHeaders) {
    const headerKey = String(header).trim();
    const headerLower = headerKey.toLowerCase();
    if (fieldNameLowerSet.has(headerLower)) {
      const matchedName = fieldNames.find((n) => n.toLowerCase() === headerLower);
      if (matchedName && (!allowedFields || allowedFields.has(matchedName))) {
        mapping[headerKey] = matchedName;
      }
    }
  }
  ctx.body = { mapping };
  await next();
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
    const filePath = await (0, import_import_utils.resolveAttachmentFilePath)(ctx.db, attachment);
    if (!import_fs.default.existsSync(filePath)) {
      ctx.throw(404, "File not found on disk");
    }
    const rawRows = [];
    let headerColumns = [];
    let totalRows = 0;
    let sheets = [];
    try {
      const wb = new import_exceljs.default.Workbook();
      await wb.xlsx.readFile(filePath);
      sheets = wb.worksheets.map((ws) => ws.name);
    } catch {
    }
    await (0, import_excel_parser.streamProcessExcel)(
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
      sheetNames: sheets,
      headerColumns,
      fileId,
      fileName: attachment.filename || attachment.title,
      previewRows,
      totalRows
    };
  } catch (err) {
    console.error("uploadParse \u5F02\u5E38:", err.stack || err.message || String(err));
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
  const previewLimit = Math.min(
    parseInt(params.previewLimit || ((_e = ctx.request.query) == null ? void 0 : _e.previewLimit) || "10", 10) || 10,
    100
  );
  if (!fileId) {
    ctx.throw(400, "fileId is required");
  }
  try {
    const attachRepo = ctx.db.getRepository("attachments");
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      ctx.throw(404, "Uploaded file not found in storage");
    }
    const ext = (attachment.extname || "").toLowerCase().replace(".", "");
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      ctx.throw(400, "Unsupported format: " + ext + ". Only .xlsx, .xls, .csv allowed");
    }
    const filePath = await (0, import_import_utils.resolveAttachmentFilePath)(ctx.db, attachment);
    if (!import_fs.default.existsSync(filePath)) {
      ctx.throw(404, "File not found on disk: " + filePath);
    }
    const rawRows = [];
    let columns = [];
    let totalRows = 0;
    const hRow = parseInt(String(headerRow), 10) || 1;
    await (0, import_excel_parser.streamProcessExcel)(
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
  const effectiveImportMode = importMode || "insert";
  if (perm.importMode.length > 0 && !perm.importMode.includes(effectiveImportMode)) {
    ctx.throw(
      403,
      "\u60A8\u7684\u6743\u9650\u4E0D\u5141\u8BB8\u4F7F\u7528\u300C" + effectiveImportMode + "\u300D\u6A21\u5F0F\u5BFC\u5165\u6570\u636E\u8868\u300C" + tableName + "\u300D\uFF0C\u5141\u8BB8\u7684\u6A21\u5F0F\uFF1A" + perm.importMode.join("\u3001")
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
      importMode: effectiveImportMode,
      sheetName: sheetName || "",
      headerRow: headerRow || 1,
      importFileId: fileId,
      fileName: attachment.filename || attachment.title || "",
      uniqueFields: uniqueFields || [],
      requiredFields: perm.requiredFields || [],
      totalRows: 0,
      progress: 0,
      createdById: (_a = ctx.state.currentUser) == null ? void 0 : _a.id,
      blankCellMode: blankCellMode || "update"
    }
  });
  const taskId = task.id;
  ctx.body = { taskId };
  await next();
  try {
    const { triggerImportScheduler } = await import("../workers/zombie-guard");
    triggerImportScheduler();
  } catch {
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  autoMatch,
  executeImport,
  getTableFields,
  preview,
  uploadParse
});
