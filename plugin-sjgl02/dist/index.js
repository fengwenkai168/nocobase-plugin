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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => plugin_default
});
module.exports = __toCommonJS(index_exports);

// src/server/plugin.ts
var import_server = require("@nocobase/server");

// src/server/actions/import.ts
var XLSX = __toESM(require("xlsx"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
async function getTableFields(ctx, next) {
  const { tableName } = ctx.action.params;
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, `Table ${tableName} not found`);
  }
  let rawFields = [];
  try {
    rawFields = Array.from(coll.fields?.values() || coll.fields || []);
  } catch {
    rawFields = [];
  }
  const fields = rawFields.map((f) => ({
    name: f.name,
    type: f.type,
    uiSchema: f.options?.uiSchema || null,
    interface: f.options?.interface || null,
    isRequired: f.options?.allowNull === false,
    isRelation: ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type)
  }));
  ctx.body = fields;
  await next();
}
async function uploadParse(ctx, next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { fileId } = params;
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
      ctx.throw(400, `Unsupported format: ${ext}. Only .xlsx, .xls, .csv allowed`);
    }
    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
    const filePath = import_path.default.join(storageDir, attachment.path || attachment.filename);
    if (!import_fs.default.existsSync(filePath)) {
      ctx.throw(404, "File not found on disk");
    }
    const workbook = XLSX.readFile(filePath, { type: "file" });
    const sheets = workbook.SheetNames;
    const firstSheet = sheets[0];
    const ws = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const headerColumns = (rows[0] || []).map((h) => String(h));
    ctx.body = {
      sheets,
      headerColumns,
      fileId,
      fileName: attachment.filename || attachment.title
    };
  } catch (err) {
    if (err.status) throw err;
    ctx.throw(500, "Failed to parse file: " + err.message);
  }
  await next();
}
async function preview(ctx, next) {
  const { fileId, sheetName, headerRow } = ctx.action.params;
  try {
    const attachRepo = ctx.db.getRepository("attachments");
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      ctx.throw(404, "Uploaded file not found in storage");
    }
    const filePath = import_path.default.join(
      process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads",
      attachment.path || attachment.filename
    );
    if (!import_fs.default.existsSync(filePath)) {
      ctx.throw(404, "File not found on disk: " + filePath);
    }
    const workbook = XLSX.readFile(filePath, { type: "file" });
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheetName];
    if (!sheet) {
      ctx.throw(400, `Sheet "${targetSheetName}" not found`);
    }
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const hRow = (headerRow || 1) - 1;
    const headers = (allRows[hRow] || []).map((h) => String(h));
    const dataRows = allRows.slice(hRow + 1).filter((r) => r.some((c) => c !== ""));
    const previewRows = dataRows.slice(0, 10).map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== void 0 ? row[i] : "";
      });
      return obj;
    });
    ctx.body = {
      rows: previewRows,
      totalRows: dataRows.length,
      columns: headers
    };
  } catch (err) {
    if (err.status) throw err;
    ctx.throw(500, "Failed to preview file: " + err.message);
  }
  await next();
}
async function executeImport(ctx, next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { tableName, fileId, sheetName, headerRow, fieldMapping, importMode, uniqueFields } = params;
  if (!tableName || !fileId) {
    ctx.throw(400, "tableName and fileId are required");
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, `Table ${tableName} not found`);
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
      status: "processing",
      fieldMapping: fieldMapping || {},
      importMode: importMode || "insert",
      sheetName: sheetName || "Sheet1",
      headerRow: headerRow || 1,
      importFileId: fileId,
      totalRows: 0,
      progress: 0,
      createdById: ctx.state.currentUser?.id
    }
  });
  const sequelize = ctx.db.sequelize;
  const transaction = await sequelize.transaction();
  try {
    const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
    const filePath = import_path.default.join(storageDir, attachment.path || attachment.filename);
    if (!import_fs.default.existsSync(filePath)) {
      throw new Error("File not found on disk: " + filePath);
    }
    const workbook = XLSX.readFile(filePath, { type: "file" });
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheetName];
    if (!sheet) {
      throw new Error(`Sheet "${targetSheetName}" not found`);
    }
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const hRow = (headerRow || 1) - 1;
    const headers = (allRows[hRow] || []).map((h) => String(h));
    const dataRows = allRows.slice(hRow + 1).filter((r) => r.some((c) => c !== ""));
    const mapping = fieldMapping || {};
    const totalRows = dataRows.length;
    await repo.update({ filterByTk: task.id, values: { totalRows }, transaction });
    const targetRepo = ctx.db.getRepository(tableName);
    const errorLogs = [];
    let processedRows = 0;
    const makeRecord = (row) => {
      const record = {};
      for (const [tableField, excelCol] of Object.entries(mapping)) {
        if (!excelCol || excelCol === "__ignore__") continue;
        const colIndex = headers.indexOf(excelCol);
        if (colIndex >= 0 && colIndex < row.length) {
          record[tableField] = row[colIndex];
        } else {
          record[tableField] = excelCol;
        }
      }
      return record;
    };
    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = i + 1;
      try {
        const record = makeRecord(dataRows[i]);
        if (importMode === "update" || importMode === "upsert") {
          const uFields = uniqueFields || [];
          if (uFields.length === 0) {
            errorLogs.push({
              row: rowIndex,
              reason: "\u66F4\u65B0\u6A21\u5F0F\u672A\u914D\u7F6E\u552F\u4E00\u503C\u5B57\u6BB5\uFF0C\u65E0\u6CD5\u5339\u914D\u5DF2\u6709\u8BB0\u5F55",
              snapshot: JSON.stringify(dataRows[i]).substring(0, 500)
            });
            continue;
          }
          const filter = {};
          for (const uf of uFields) {
            if (record[uf] !== void 0) filter[uf] = record[uf];
          }
          if (Object.keys(filter).length > 0) {
            const existing = await targetRepo.findOne({ filter, transaction });
            if (existing) {
              await targetRepo.update({ filterByTk: existing.id, values: record, transaction });
              processedRows++;
              continue;
            }
          } else {
            errorLogs.push({
              row: rowIndex,
              reason: "\u552F\u4E00\u503C\u5B57\u6BB5\u5728\u6570\u636E\u884C\u4E2D\u672A\u627E\u5230\u503C\uFF0C\u65E0\u6CD5\u5339\u914D",
              snapshot: JSON.stringify(dataRows[i]).substring(0, 500)
            });
            continue;
          }
        }
        if (importMode === "insert" || importMode === "upsert") {
          await targetRepo.create({ values: record, transaction });
          processedRows++;
        } else if (importMode === "update") {
          errorLogs.push({
            row: rowIndex,
            reason: "\u672A\u5339\u914D\u5230\u5DF2\u6709\u8BB0\u5F55\uFF08\u66F4\u65B0\u6A21\u5F0F\uFF09",
            snapshot: JSON.stringify(dataRows[i]).substring(0, 500)
          });
        }
      } catch (rowErr) {
        errorLogs.push({
          row: rowIndex,
          reason: rowErr.message || String(rowErr),
          snapshot: JSON.stringify(dataRows[i]).substring(0, 500)
        });
      }
    }
    if (errorLogs.length > 0) {
      await transaction.rollback();
      await repo.update({
        filterByTk: task.id,
        values: {
          status: "failed",
          progress: 0,
          processedRows: 0,
          errorLogs,
          errorMessage: `${errorLogs.length} row(s) failed, transaction rolled back`,
          completedAt: /* @__PURE__ */ new Date()
        }
      });
    } else {
      await transaction.commit();
      await repo.update({
        filterByTk: task.id,
        values: {
          status: "completed",
          progress: 100,
          processedRows,
          completedAt: /* @__PURE__ */ new Date()
        }
      });
    }
  } catch (err) {
    await transaction.rollback();
    await repo.update({
      filterByTk: task.id,
      values: {
        status: "failed",
        errorMessage: err.message || String(err),
        completedAt: /* @__PURE__ */ new Date()
      }
    });
  }
  ctx.body = { taskId: task.id };
  await next();
}

// src/server/actions/export.ts
var import_exceljs = __toESM(require("exceljs"));
var import_fs2 = __toESM(require("fs"));
var import_promises = __toESM(require("fs/promises"));
var import_path2 = __toESM(require("path"));
var import_archiver = __toESM(require("archiver"));
var import_async_mutex = require("async-mutex");
var exportMutex = new import_async_mutex.Mutex();
function sanitizeSheetName(name) {
  return name.replace(/[\\\/\*\?\[\]:!@#\$%\^&\(\)]/g, "_").substring(0, 31);
}
function formatValue(val) {
  if (val === null || val === void 0) return "";
  if (typeof val === "object") return JSON.stringify(val);
  if (val instanceof Date) return val.toISOString();
  return String(val);
}
function getScalarFields(coll) {
  const names = [];
  try {
    for (const f of Array.from(coll.fields?.values() || coll.fields || [])) {
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
  const fields = [];
  try {
    for (const f of Array.from(coll.fields?.values() || coll.fields || [])) {
      const type = f.type;
      if (["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(type)) {
        fields.push({
          name: f.name,
          type,
          target: f.options?.target || f.target || ""
        });
      }
    }
  } catch {
  }
  return fields;
}
async function getExportTableFields(ctx, next) {
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
    rawFields = Array.from(coll.fields?.values() || coll.fields || []);
  } catch {
    rawFields = [];
  }
  const fields = rawFields.map((f) => ({
    name: f.name,
    type: f.type,
    uiSchema: f.options?.uiSchema || null,
    interface: f.options?.interface || null,
    isRequired: f.options?.allowNull === false,
    isAssociation: ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type)
  }));
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
      if (name.startsWith("sjgl02_")) continue;
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
      totalRows: 0,
      progress: 0,
      createdById: ctx.state.currentUser?.id
    }
  });
  const release = await exportMutex.acquire();
  try {
    const isAllTables = tableName === "__all__";
    const tableList = isAllTables ? (() => {
      const names = [];
      const collections = ctx.db.collections;
      for (const [name, coll] of collections) {
        if (name.startsWith("sjgl02_")) continue;
        try {
          if (coll.isThrough && coll.isThrough()) continue;
        } catch {
        }
        names.push(name);
      }
      return names;
    })() : [tableName];
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:\.]/g, "-").substring(0, 19);
    const tempDir = import_path2.default.join(process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads", "exports");
    if (!import_fs2.default.existsSync(tempDir)) import_fs2.default.mkdirSync(tempDir, { recursive: true });
    let totalRows = 0;
    let processedRows = 0;
    const outputFiles = [];
    for (const tblName of tableList) {
      const coll = ctx.db.getCollection(tblName);
      if (!coll) continue;
      const targetRepo = ctx.db.getRepository(tblName);
      if (!targetRepo) continue;
      let records = [];
      let collectionTotal = 0;
      try {
        const [found, count] = await targetRepo.findAndCount({ filter: exportFilter || {}, limit: 2e4 });
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
      if (records.length === 0) continue;
      const fieldNames = selectedFields && selectedFields.length > 0 ? selectedFields : getScalarFields(coll);
      if (fieldNames.length === 0 && records[0]) {
        fieldNames.push(...Object.keys(records[0]).filter((k) => !k.startsWith("_")));
      }
      const workbook = new import_exceljs.default.Workbook();
      workbook.creator = "NocoBase sjgl02 plugin";
      const mainSheet = workbook.addWorksheet(sanitizeSheetName(tblName));
      mainSheet.columns = fieldNames.map((name) => ({
        header: name,
        key: name,
        width: Math.max(name.length + 4, 20)
      }));
      const headerRow = mainSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      for (const record of records) {
        const row = {};
        for (const f of fieldNames) {
          let val = record[f];
          if (val !== null && val !== void 0 && typeof val === "object" && !(val instanceof Date)) {
            val = val.nickname || val.title || val.name || val.id || JSON.stringify(val);
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
          const sheetName = sanitizeSheetName(`${tblName}_${af.name}`).substring(0, 31);
          const assocSheet = workbook.addWorksheet(sheetName);
          assocSheet.columns = assocScalarFields.map((n) => ({
            header: n,
            key: n,
            width: Math.max(n.length + 4, 20)
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
      const cleanName = sanitizeSheetName(tblName).replace(/\s+/g, "_");
      const filePath = import_path2.default.join(tempDir, `${cleanName}_${timestamp}.xlsx`);
      await workbook.xlsx.writeFile(filePath);
      outputFiles.push(filePath);
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
      finalFilePath = import_path2.default.join(tempDir, `all_tables_${timestamp}.zip`);
      const output = import_fs2.default.createWriteStream(finalFilePath);
      const archive = (0, import_archiver.default)("zip", { zlib: { level: 9 } });
      await new Promise((resolve, reject) => {
        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);
        for (const fp of outputFiles) {
          archive.file(fp, { name: import_path2.default.basename(fp) });
        }
        archive.finalize();
      });
      for (const fp of outputFiles) {
        try {
          import_fs2.default.unlinkSync(fp);
        } catch {
        }
      }
    }
    const stats = await import_promises.default.stat(finalFilePath);
    const attachRepo = ctx.db.getRepository("attachments");
    const exportAttachment = await attachRepo.create({
      values: {
        title: import_path2.default.basename(finalFilePath),
        filename: import_path2.default.basename(finalFilePath),
        extname: import_path2.default.extname(finalFilePath),
        mimetype: finalFilePath.endsWith(".zip") ? "application/zip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: stats.size,
        path: finalFilePath.replace(
          process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads",
          ""
        ).replace(/^\//, "")
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
  if (task.exportFileId) {
    ctx.body = { downloadUrl: `/api/attachments:download/${task.exportFileId}` };
  } else {
    ctx.body = { downloadUrl: null };
  }
  await next();
}

// src/server/actions/tasks.ts
async function listTasks(ctx, next) {
  const { taskType, status } = ctx.action.params;
  const page = Math.max(1, parseInt(ctx.action.params.page || "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(ctx.action.params.pageSize || "20", 10) || 20));
  const filter = {};
  if (taskType && taskType !== "all") filter.taskType = taskType;
  if (status && status !== "all") filter.status = status;
  const taskViewScope = await getTaskViewScope(ctx);
  if (taskViewScope === "own" && ctx.state.currentUser?.id) {
    filter.createdById = ctx.state.currentUser.id;
  }
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const [rows, total] = await repo.findAndCount({
    filter,
    appends: ["createdBy"],
    page,
    pageSize,
    sort: ["-createdAt"]
  });
  ctx.body = {
    rows,
    meta: { total, page, pageSize }
  };
  await next();
}
async function getTaskDetail(ctx, next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({
    filter: { id: taskId },
    appends: ["createdBy"]
  });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  ctx.body = task;
  await next();
}
async function cancelTask(ctx, next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { taskId } = params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  if (["completed", "failed", "cancelled"].includes(task.status)) {
    ctx.throw(400, "Cannot cancel a completed/failed/cancelled task");
  }
  await repo.update({
    filterByTk: task.id,
    values: { status: "cancelled", progress: task.progress }
  });
  ctx.body = { success: true };
  await next();
}
async function getTaskViewScope(ctx) {
  try {
    const settingRepo = ctx.db.getRepository("sjgl02_settings");
    const settings = await settingRepo.findOne();
    return settings?.taskViewScope || "own";
  } catch {
    return "own";
  }
}

// src/server/actions/permissions.ts
async function getUserRoleList(ctx, next) {
  const userRepo = ctx.db.getRepository("users");
  const roleRepo = ctx.db.getRepository("roles");
  const users = await userRepo.find({ limit: 500, sort: ["id"] });
  const roles = await roleRepo.find({ limit: 200, sort: ["name"] });
  ctx.body = {
    users: users.map((u) => ({
      id: String(u.id),
      nickname: u.nickname || u.username || u.email,
      type: "user"
    })),
    roles: roles.map((r) => ({
      id: String(r.name),
      name: r.name,
      title: r.title,
      type: "role"
    }))
  };
  await next();
}
async function getTables(ctx, next) {
  const collections = [];
  try {
    const dbCollections = ctx.db.collections;
    if (dbCollections instanceof Map) {
      for (const [name, coll] of dbCollections) {
        try {
          const isThrough = coll.isThrough ? coll.isThrough() : false;
          if (!isThrough) {
            collections.push({
              name,
              title: coll.options?.title || name
            });
          }
        } catch {
          collections.push({
            name,
            title: coll.options?.title || name
          });
        }
      }
    }
  } catch {
  }
  ctx.body = collections;
  await next();
}
async function getPermissions(ctx, next) {
  const { targetType, targetId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_table_permissions");
  const permissions = await repo.find({ filter: { targetType, targetId } });
  ctx.body = permissions;
  await next();
}
async function savePermissions(ctx, next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { permissions } = params;
  if (!permissions || !Array.isArray(permissions)) {
    ctx.body = { success: true };
    await next();
    return;
  }
  const repo = ctx.db.getRepository("sjgl02_table_permissions");
  const existingPerms = await repo.find();
  const submittedTableNames = new Set(permissions.map((p) => p.tableName));
  for (const existing of existingPerms) {
    if (!submittedTableNames.has(existing.tableName)) {
      await repo.destroy({ filterByTk: existing.id });
    }
  }
  for (const perm of permissions) {
    if (perm.id) {
      await repo.update({ filterByTk: perm.id, values: perm });
    } else {
      await repo.create({ values: perm });
    }
  }
  ctx.body = { success: true };
  await next();
}
async function getSettings(ctx, next) {
  const repo = ctx.db.getRepository("sjgl02_settings");
  let settings = await repo.findOne();
  if (!settings) {
    settings = await repo.create({
      values: { taskViewScope: "own", maxFileSize: 50, batchSize: 1e3 }
    });
  }
  ctx.body = settings;
  await next();
}
async function saveSettings(ctx, next) {
  const values = ctx.action.params.values || ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_settings");
  let settings = await repo.findOne();
  if (settings) {
    await repo.update({ filterByTk: settings.id, values });
  } else {
    await repo.create({ values });
  }
  ctx.body = { success: true };
  await next();
}

// src/server/plugin.ts
var PluginSjgl02Server = class extends import_server.Plugin {
  async load() {
    this.defineCustomResources();
    this.setupACL();
  }
  defineCustomResources() {
    this.app.resourceManager.define({
      name: "sjgl02Import",
      actions: {
        tableFields: getTableFields,
        uploadParse,
        preview,
        execute: executeImport
      }
    });
    this.app.resourceManager.define({
      name: "sjgl02Export",
      actions: {
        tableFields: getExportTableFields,
        previewCount,
        execute: executeExport,
        progress: getProgress,
        download: downloadExport
      }
    });
    this.app.resourceManager.define({
      name: "sjgl02Tasks",
      actions: {
        list: listTasks,
        detail: getTaskDetail,
        cancel: cancelTask
      }
    });
    this.app.resourceManager.define({
      name: "sjgl02Permissions",
      actions: {
        userRoleList: getUserRoleList,
        tables: getTables,
        get: getPermissions,
        save: savePermissions,
        settings: getSettings,
        saveSettings
      }
    });
  }
  setupACL() {
    const acl = this.app.acl;
    acl.allow("sjgl02Import", "*", "loggedIn");
    acl.allow("sjgl02Export", "*", "loggedIn");
    acl.allow("sjgl02Tasks", "*", "loggedIn");
    acl.allow("sjgl02Permissions", "*", "loggedIn");
    acl.allow("sjgl02_tasks", "*", "loggedIn");
    acl.allow("sjgl02_table_permissions", "*", "loggedIn");
    acl.allow("sjgl02_settings", "*", "loggedIn");
  }
  async install() {
    const settingRepo = this.db.getRepository("sjgl02_settings");
    const existing = await settingRepo.count();
    if (existing === 0) {
      await settingRepo.create({
        values: {
          taskViewScope: "own",
          maxFileSize: 50,
          batchSize: 1e3
        }
      });
    }
    const permRepo = this.db.getRepository("sjgl02_table_permissions");
    const permCount = await permRepo.count();
    if (permCount === 0) {
      const roleRepo = this.db.getRepository("roles");
      const adminRole = await roleRepo.findOne({ filter: { name: "admin" } });
      const roleId = adminRole ? String(adminRole.name) : "admin";
      const tables = this.db.collections;
      const tablePermissions = [];
      for (const [name] of tables) {
        if (name.startsWith("sjgl02_")) continue;
        tablePermissions.push({
          targetType: "role",
          targetId: roleId,
          targetName: "\u7BA1\u7406\u5458",
          tableName: name,
          canImport: true,
          canExport: true,
          importMode: "insert",
          uniqueFields: [],
          requiredFields: [],
          importFields: [],
          exportFields: []
        });
      }
      if (tablePermissions.length > 0) {
        for (const perm of tablePermissions) {
          await permRepo.create({ values: perm });
        }
      }
    }
  }
};
var plugin_default = PluginSjgl02Server;
