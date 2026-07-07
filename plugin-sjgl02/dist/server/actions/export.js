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
  previewCount: () => previewCount,
  resolveAttachmentFromFile: () => resolveAttachmentFromFile
});
module.exports = __toCommonJS(export_exports);
var import_fs = __toESM(require("fs"));
var import_promises = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var import_permission_check = require("./permission-check");
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
  const { tableName, permSource } = params;
  if (!tableName || tableName === "__all__") {
    ctx.body = { estimatedRows: 0 };
    await next();
    return;
  }
  const exportPerm = await (0, import_permission_check.checkExportPermission)(ctx, tableName, permSource);
  if (!exportPerm.canExport) {
    ctx.throw(403, "Access denied");
  }
  const repo = ctx.db.getRepository(tableName);
  const count = repo ? await repo.count({ filter: {} }) : 0;
  ctx.body = { estimatedRows: count };
  await next();
}
async function executeExport(ctx, next) {
  var _a, _b;
  const params = ctx.action.params.values || ctx.action.params;
  const {
    tableName,
    selectedFields,
    associationDisplayMode,
    includeAssociationSheet,
    associationSheetTables,
    fileNameTemplate,
    includeAttachments,
    headerStyle,
    permSource
  } = params;
  if (!tableName) {
    ctx.throw(400, "tableName is required");
  }
  if (tableName !== "__all__") {
    const exportPerm = await (0, import_permission_check.checkExportPermission)(ctx, tableName, permSource);
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
        const permCheck = await (0, import_permission_check.checkExportPermission)(ctx, name, permSource);
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
          if (repo2) estimatedTotal += await repo2.count({ filter: {} });
        } catch {
        }
      }
    } else {
      const tRepo = ctx.db.getRepository(tableName);
      if (tRepo) estimatedTotal = await tRepo.count({ filter: {} });
    }
  } catch {
  }
  const repo = ctx.db.getRepository("sjgl02_tasks");
  if (tableName === "__all__" && allowedTableList && allowedTableList.length > 0) {
    const tableListConfig = allowedTableList.map((t) => ({ tableName: t, fields: selectedFields || [] }));
    const task2 = await repo.create({
      values: {
        taskType: "export",
        tableName: "__all__",
        status: "pending",
        selectedFields: tableListConfig,
        headerStyle: headerStyle || "title_id",
        permSource: permSource || null,
        createdById: (_a = ctx.state.currentUser) == null ? void 0 : _a.id,
        totalRows: estimatedTotal,
        progress: 0,
        includeAttachments: includeAttachments || false,
        fileNameTemplate: fileNameTemplate || ""
      }
    });
    ctx.body = { taskId: task2.id };
    await next();
    try {
      const { triggerExportScheduler } = await import("../workers/zombie-guard");
      triggerExportScheduler();
    } catch {
    }
    return;
  }
  const task = await repo.create({
    values: {
      taskType: "export",
      tableName,
      status: "pending",
      selectedFields: selectedFields || [],
      permSource: permSource || null,
      associationDisplayMode: associationDisplayMode || {},
      includeAssociationSheet: includeAssociationSheet || false,
      associationSheetTables: associationSheetTables || [],
      includeAttachments: includeAttachments || false,
      totalRows: estimatedTotal,
      progress: 0,
      fileName: "",
      createdById: (_b = ctx.state.currentUser) == null ? void 0 : _b.id,
      headerStyle: headerStyle || "title_id",
      fileNameTemplate: fileNameTemplate || ""
    }
  });
  ctx.body = { taskId: task.id };
  await next();
  try {
    const { triggerExportScheduler } = await import("../workers/zombie-guard");
    triggerExportScheduler();
  } catch {
  }
}
async function resolveAttachmentFromFile(db, tempFilePath, taskId) {
  try {
    const storageDir = process.env.STORAGE_DIR || "storage/uploads";
    let absPath;
    if (import_path.default.isAbsolute(tempFilePath)) {
      absPath = tempFilePath;
    } else if (tempFilePath.includes("/") || tempFilePath.includes("\\")) {
      absPath = tempFilePath;
    } else {
      absPath = import_path.default.join(storageDir, "exports", tempFilePath);
    }
    absPath = import_path.default.resolve(absPath);
    if (!import_fs.default.existsSync(absPath)) return null;
    const stats = await import_promises.default.stat(absPath);
    const attachRepo = db.getRepository("attachments");
    const fileName = import_path.default.basename(absPath);
    const attachment = await attachRepo.create({
      values: {
        title: fileName,
        filename: fileName,
        extname: import_path.default.extname(absPath),
        mimetype: resolveMimeType(absPath),
        size: stats.size,
        path: import_path.default.relative(storageDir, absPath).replace(/\\/g, "/")
      }
    });
    return attachment.id;
  } catch {
    return null;
  }
}
function resolveMimeType(absPath) {
  if (absPath.endsWith(".tar.gz")) return "application/gzip";
  if (absPath.endsWith(".zip")) return "application/zip";
  if (absPath.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
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
  var _a, _b;
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  const currentUserId = (_a = ctx.state.currentUser) == null ? void 0 : _a.id;
  const isAdmin = (((_b = ctx.state.currentUser) == null ? void 0 : _b.roles) || []).some((r) => r.name === "admin" || r.name === "root");
  if (!isAdmin && task.createdById !== currentUserId) {
    ctx.throw(403, "Access denied");
  }
  if (!task.exportFileId) {
    ctx.throw(404, "Export file not found");
  }
  const attachRepo = ctx.db.getRepository("attachments");
  const attachment = await attachRepo.findOne({ filter: { id: task.exportFileId } });
  if (!attachment) {
    ctx.throw(404, "Attachment record not found");
  }
  const storageDir = process.env.STORAGE_DIR || "storage/uploads";
  const filePath = import_path.default.join(storageDir, attachment.path ?? attachment.filename);
  if (!import_fs.default.existsSync(filePath)) {
    ctx.throw(404, "File not found on disk");
  }
  const fileName = attachment.title || attachment.filename || "export.xlsx";
  ctx.attachment(fileName);
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
  previewCount,
  resolveAttachmentFromFile
});
