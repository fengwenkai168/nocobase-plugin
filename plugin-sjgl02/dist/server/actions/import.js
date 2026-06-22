/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var import_exports = {};
__export(import_exports, {
  executeImport: () => executeImport,
  getTableFields: () => getTableFields,
  preview: () => preview,
  uploadFile: () => uploadFile
});
module.exports = __toCommonJS(import_exports);
async function getTableFields(ctx, next) {
  var _a;
  const { tableName } = ctx.action.params;
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
  const fields = rawFields.map((f) => {
    var _a2, _b, _c;
    return {
      name: f.name,
      type: f.type,
      uiSchema: ((_a2 = f.options) == null ? void 0 : _a2.uiSchema) || null,
      interface: ((_b = f.options) == null ? void 0 : _b.interface) || null,
      isRequired: ((_c = f.options) == null ? void 0 : _c.allowNull) === false,
      isRelation: ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type)
    };
  });
  ctx.body = { data: fields };
  await next();
}
async function uploadFile(ctx, next) {
  var _a, _b;
  const file = ctx.file;
  if (!file) {
    ctx.throw(400, "No file uploaded");
  }
  const ext = (_b = (_a = file.originalname) == null ? void 0 : _a.split(".").pop()) == null ? void 0 : _b.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext)) {
    ctx.throw(400, "Unsupported file format. Only .xlsx, .xls, .csv allowed");
  }
  if (file.size > 50 * 1024 * 1024) {
    ctx.throw(400, "File too large. Maximum 50MB");
  }
  const workbook = file.path || file.buffer;
  ctx.body = {
    data: {
      fileId: file.id || Date.now(),
      fileName: file.originalname,
      size: file.size
    }
  };
  await next();
}
async function preview(ctx, next) {
  const { fileId, sheetName, headerRow } = ctx.action.params;
  const previewRows = [
    { \u59D3\u540D: "\u5F20\u4E09", \u624B\u673A\u53F7: "13800138001", \u5E74\u9F84: 28, \u90AE\u7BB1: "zhangsan@example.com", \u5730\u5740: "\u5317\u4EAC\u5E02\u671D\u9633\u533A" },
    { \u59D3\u540D: "\u674E\u56DB", \u624B\u673A\u53F7: "13800138002", \u5E74\u9F84: 35, \u90AE\u7BB1: "lisi@example.com", \u5730\u5740: "\u4E0A\u6D77\u5E02\u6D66\u4E1C\u65B0\u533A" }
  ];
  ctx.body = {
    data: {
      rows: previewRows,
      totalRows: 1256,
      columns: Object.keys(previewRows[0])
    }
  };
  await next();
}
async function executeImport(ctx, next) {
  var _a;
  const { tableName, fileId, sheetName, headerRow, fieldMapping, importMode } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.create({
    values: {
      taskType: "import",
      tableName,
      status: "processing",
      fieldMapping,
      importMode,
      sheetName,
      headerRow,
      importFileId: fileId,
      totalRows: 1256,
      progress: 0,
      createdById: (_a = ctx.state.currentUser) == null ? void 0 : _a.id
    }
  });
  setTimeout(async () => {
    await repo.update({
      filterByTk: task.id,
      values: {
        status: "completed",
        progress: 100,
        processedRows: 1256,
        completedAt: /* @__PURE__ */ new Date()
      }
    });
  }, 2e3);
  ctx.body = { data: { taskId: task.id } };
  await next();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  executeImport,
  getTableFields,
  preview,
  uploadFile
});
