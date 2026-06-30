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
function getFieldDisplayName(coll, fieldName) {
  var _a, _b;
  try {
    const f = coll.fields instanceof Map ? coll.fields.get(fieldName) : null;
    const title = (_b = (_a = f == null ? void 0 : f.options) == null ? void 0 : _a.uiSchema) == null ? void 0 : _b.title;
    if (title && !/^\{\{/.test(title)) return `${title}(${fieldName})`;
  } catch {
  }
  return fieldName;
}
function getCollDisplayName(coll) {
  var _a;
  const rawName = (coll == null ? void 0 : coll.name) || "";
  let title = ((_a = coll == null ? void 0 : coll.options) == null ? void 0 : _a.title) || rawName;
  if (/^\{\{/.test(title)) title = rawName;
  return title !== rawName ? `${title}(${rawName})` : rawName;
}
function ensureUniqueSheetName(workbook, name) {
  const existing = new Set(workbook.worksheets.map((s) => s.name));
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
  var _a, _b, _c, _d, _e;
  const params = ctx.action.params.values || ctx.action.params;
  const {
    tableName,
    selectedFields,
    associationDisplayMode,
    includeAssociationSheet,
    associationSheetTables,
    filter,
    fileNameTemplate,
    includeAttachments
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
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.create({
    values: {
      taskType: "export",
      tableName,
      status: "processing",
      selectedFields: selectedFields || [],
      exportFilter: exportFilter || {},
      associationDisplayMode: associationDisplayMode || {},
      includeAssociationSheet: includeAssociationSheet || false,
      associationSheetTables: associationSheetTables || [],
      includeAttachments: includeAttachments || false,
      totalRows: 0,
      progress: 0,
      createdById: (_a = ctx.state.currentUser) == null ? void 0 : _a.id
    }
  });
  const release = await exportMutex.acquire();
  try {
    const isAllTables = tableName === "__all__";
    const tableList = isAllTables ? (() => {
      const names = [];
      const collections = ctx.db.collections;
      for (const [name] of collections) {
        names.push(name);
      }
      return names;
    })() : [tableName];
    const tempDir = import_path.default.join(process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads", "exports");
    if (!import_fs.default.existsSync(tempDir)) import_fs.default.mkdirSync(tempDir, { recursive: true });
    let totalRows = 0;
    let processedRows = 0;
    const outputFiles = [];
    for (const tblName of tableList) {
      const coll = ctx.db.getCollection(tblName);
      if (!coll) continue;
      const targetRepo = ctx.db.getRepository(tblName);
      if (!targetRepo) continue;
      if (tableName === "__all__") {
        try {
          const permCheck = await (0, import_permission_check.checkExportPermission)(ctx, tblName);
          if (!permCheck.canExport) continue;
        } catch {
          continue;
        }
      }
      let records = [];
      let collectionTotal = 0;
      const appendFields = [];
      const attachmentFieldNames = [];
      const fileIdFieldNames = [];
      try {
        for (const f of Array.from(((_b = coll.fields) == null ? void 0 : _b.values()) || coll.fields || [])) {
          if (f.type === "belongsTo") appendFields.push(f.name);
          if (includeAttachments && f.type === "belongsToMany") {
            const interfaceName = (_c = f.options) == null ? void 0 : _c.interface;
            if (interfaceName === "attachment" && !appendFields.includes(f.name)) {
              appendFields.push(f.name);
              attachmentFieldNames.push(f.name);
            }
          }
          if (includeAttachments && f.type === "integer" && /FileId$/.test(f.name)) {
            fileIdFieldNames.push(f.name);
          }
        }
      } catch {
      }
      const queryOpts = { filter: exportFilter || {}, limit: 2e4 };
      if (appendFields.length > 0) queryOpts.appends = appendFields;
      try {
        const [found, count] = await targetRepo.findAndCount(queryOpts);
        records = found;
        collectionTotal = count;
      } catch {
        try {
          records = await targetRepo.find({ filter: exportFilter || {}, limit: 2e4 });
          collectionTotal = records.length;
        } catch {
          continue;
        }
      }
      const fieldNames = selectedFields && selectedFields.length > 0 ? selectedFields : getScalarFields(coll);
      if (fieldNames.length === 0 && records[0]) {
        fieldNames.push(...Object.keys(records[0]).filter((k) => !k.startsWith("_")));
      }
      if (records.length === 0 && fieldNames.length === 0) continue;
      const workbook = new import_exceljs.default.Workbook();
      workbook.creator = "NocoBase @my-project/plugin-sjgl02";
      const mainSheet = workbook.addWorksheet(ensureUniqueSheetName(workbook, sanitizeSheetName(getCollDisplayName(coll))));
      mainSheet.columns = fieldNames.map((name) => ({
        header: getFieldDisplayName(coll, name),
        key: name,
        width: Math.max(getFieldDisplayName(coll, name).length + 4, 20)
      }));
      const headerRow = mainSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      const fileIdFilenameMap = /* @__PURE__ */ new Map();
      const attachedIds = /* @__PURE__ */ new Set();
      const attachFieldMap = /* @__PURE__ */ new Map();
      if (includeAttachments && (attachmentFieldNames.length > 0 || fileIdFieldNames.length > 0)) {
        for (const record of records) {
          for (const afName of attachmentFieldNames) {
            const av = record[afName];
            if (Array.isArray(av)) {
              for (const a of av) {
                if ((a == null ? void 0 : a.id) && !attachedIds.has(a.id)) {
                  attachedIds.add(a.id);
                  attachFieldMap.set(a.id, afName);
                }
              }
            }
          }
          for (const ffName of fileIdFieldNames) {
            const fid = record[ffName];
            if (fid && !attachedIds.has(fid)) {
              attachedIds.add(fid);
              attachFieldMap.set(fid, ffName);
            }
          }
        }
        if (attachedIds.size > 0) {
          try {
            const attachRepo2 = ctx.db.getRepository("attachments");
            const attachRecords = await attachRepo2.find({ filter: { id: Array.from(attachedIds) } });
            for (const at of attachRecords) {
              if (at.filename) fileIdFilenameMap.set(at.id, at.filename);
            }
          } catch {
          }
        }
      }
      for (const record of records) {
        const row = {};
        for (const f of fieldNames) {
          let val = record[f];
          if (attachmentFieldNames.includes(f)) {
            if (Array.isArray(val) && val.length > 0) {
              val = val.map((a) => a.filename || a.title || a.id || "").join(", ");
            } else {
              val = "";
            }
          } else if (fileIdFieldNames.includes(f)) {
            val = fileIdFilenameMap.get(val) || String(val || "");
          } else if (val !== null && val !== void 0 && typeof val === "object" && !(val instanceof Date)) {
            const targetTitleField = ((_d = coll.options) == null ? void 0 : _d.titleField) || "id";
            val = val[targetTitleField] || val.id || JSON.stringify(val);
          }
          row[f] = formatValue(val);
        }
        mainSheet.addRow(row);
        totalRows++;
        processedRows++;
      }
      if (includeAssociationSheet) {
        const assocFields = getAssociationFields(coll);
        const exportAssocFields = assocFields.filter(
          (af) => !fieldNames || fieldNames.length === 0 || fieldNames.includes(af.name)
        );
        for (const af of exportAssocFields) {
          const assocRepo = ctx.db.getRepository(af.target);
          if (!assocRepo) continue;
          let assocRecords = [];
          try {
            assocRecords = await assocRepo.find({ limit: 5e3 });
          } catch {
            continue;
          }
          if (assocRecords.length === 0) continue;
          const assocScalarFields = getScalarFields(ctx.db.getCollection(af.target));
          if (assocScalarFields.length === 0 && assocRecords[0]) {
            assocScalarFields.push(...Object.keys(assocRecords[0]).filter((k) => !k.startsWith("_")));
          }
          const assocColl = ctx.db.getCollection(af.target);
          const fieldDisplay = getFieldDisplayName(coll, af.name);
          const collDisplay2 = getCollDisplayName(assocColl);
          const sheetName = ensureUniqueSheetName(workbook, sanitizeSheetName(fieldDisplay + "-" + collDisplay2).substring(0, 31));
          const assocSheet = workbook.addWorksheet(sheetName);
          assocSheet.columns = assocScalarFields.map((n) => ({
            header: getFieldDisplayName(assocColl, n),
            key: n,
            width: Math.max(getFieldDisplayName(assocColl, n).length + 4, 20)
          }));
          const ahRow = assocSheet.getRow(1);
          ahRow.font = { bold: true };
          ahRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
          for (const rec of assocRecords) {
            const row = {};
            for (const f of assocScalarFields) {
              let val = rec[f];
              if (val !== null && val !== void 0 && typeof val === "object" && !(val instanceof Date)) {
                val = val.nickname || val.title || val.name || (val.id !== void 0 && val.id !== null ? val.id : JSON.stringify(val));
              }
              row[f] = formatValue(val);
            }
            assocSheet.addRow(row);
            totalRows++;
            processedRows++;
          }
        }
      }
      const collDisplay = sanitizeSheetName(getCollDisplayName(coll)).replace(/\s+/g, "_");
      const xlsxName = collDisplay + "-" + formatFileName("{\u65E5\u671F}.xlsx", "");
      const filePath = import_path.default.join(tempDir, xlsxName);
      await workbook.xlsx.writeFile(filePath);
      outputFiles.push(filePath);
      if (includeAttachments && attachedIds.size > 0 && fileIdFilenameMap.size > 0) {
        try {
          const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
          const attachmentFiles = [];
          for (const [aid, fn] of fileIdFilenameMap) {
            const diskPath = import_path.default.join(storageDir, fn);
            let realPath = diskPath;
            if (!import_fs.default.existsSync(realPath)) {
              const atRecords = await ctx.db.getRepository("attachments").find({ filter: { id: [aid] } });
              if (((_e = atRecords[0]) == null ? void 0 : _e.path) !== void 0) {
                realPath = import_path.default.join(storageDir, atRecords[0].path || "", fn);
              }
            }
            if (!import_fs.default.existsSync(realPath)) continue;
            const afName = attachFieldMap.get(aid) || "\u9644\u4EF6";
            const folderName = sanitizeSheetName(getFieldDisplayName(coll, afName));
            attachmentFiles.push({ entryName: `${folderName}/${fn}`, diskPath: realPath });
          }
          if (attachmentFiles.length > 0) {
            const zipName = collDisplay + "-" + formatFileName("{\u65E5\u671F}.zip", "");
            const zipPath = import_path.default.join(tempDir, zipName);
            const zipOutput = import_fs.default.createWriteStream(zipPath);
            const zipArchive = (0, import_archiver.default)("zip", { zlib: { level: 9 } });
            await new Promise((resolve, reject) => {
              zipArchive.on("error", reject);
              zipOutput.on("close", resolve);
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
            outputFiles[outputFiles.indexOf(filePath)] = zipPath;
          }
        } catch {
        }
      }
      await repo.update({
        filterByTk: task.id,
        values: { progress: Math.min(100, Math.floor(processedRows / Math.max(totalRows, 1) * 100)), processedRows, totalRows }
      });
    }
    let finalFilePath;
    if (outputFiles.length === 0) {
      throw new Error("No data to export");
    } else if (outputFiles.length === 1) {
      finalFilePath = outputFiles[0];
    } else {
      const zipName = "\u5168\u90E8\u6570\u636E\u8868-" + formatFileName("{\u65E5\u671F}.zip", "");
      finalFilePath = import_path.default.join(tempDir, zipName);
      const output = import_fs.default.createWriteStream(finalFilePath);
      const archive = (0, import_archiver.default)("zip", { zlib: { level: 9 } });
      await new Promise((resolve, reject) => {
        try {
          output.on("close", resolve);
          archive.on("error", reject);
          archive.pipe(output);
          for (const fp of outputFiles) {
            archive.file(fp, { name: import_path.default.basename(fp) });
          }
          archive.finalize();
        } catch (err) {
          reject(err);
        }
      });
      for (const fp of outputFiles) {
        try {
          import_fs.default.unlinkSync(fp);
        } catch {
        }
      }
    }
    const stats = await import_promises.default.stat(finalFilePath);
    const attachRepo = ctx.db.getRepository("attachments");
    const exportAttachment = await attachRepo.create({
      values: {
        title: import_path.default.basename(finalFilePath),
        filename: import_path.default.basename(finalFilePath),
        extname: import_path.default.extname(finalFilePath),
        mimetype: finalFilePath.endsWith(".zip") ? "application/zip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: stats.size,
        path: import_path.default.relative(process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads", finalFilePath).replace(/\\/g, "/")
      }
    });
    await repo.update({
      filterByTk: task.id,
      values: {
        status: "completed",
        progress: 100,
        processedRows,
        totalRows,
        exportFileId: exportAttachment.id,
        completedAt: /* @__PURE__ */ new Date()
      }
    });
  } catch (err) {
    await repo.update({
      filterByTk: task.id,
      values: {
        status: "failed",
        errorMessage: err.message || String(err),
        completedAt: /* @__PURE__ */ new Date()
      }
    });
  } finally {
    release();
  }
  ctx.body = { taskId: task.id };
  await next();
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
  const attachment = a