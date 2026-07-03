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
      worksheet.on("row", (row) => {
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
        const isEmpty = !vals.some((v) => v !== void 0 && v !== null && v !== "");
        if (isEmpty) {
          dataIndex++;
          return;
        }
        totalRows++;
        const shouldContinue = onRow(rowNum, dataIndex, vals);
        dataIndex++;
        if (shouldContinue === false) destroy();
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
      ctx.throw(400, `Unsupported format: ${ext}. Only .xlsx, .xls, .csv allowed`);
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
    await streamProcessExcel(filePath, sheetName, parseInt(String(headerRow), 10) || 1, (rowNum, dataIdx, vals) => {
      if (dataIdx < 0) return true;
      if (dataIdx < 10) rawRows.push(vals);
      return dataIdx < 10;
    }, (headers) => {
      headerColumns = headers;
    }).then((result) => {
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
    await streamProcessExcel(filePath, sheetName, hRow, (rowNum, dataIdx, vals) => {
      if (dataIdx < 0) return true;
      if (dataIdx < previewLimit) rawRows.push(vals);
      return dataIdx < previewLimit;
    }, (headers) => {
      columns = headers;
    }).then((result) => {
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
  const { tableName, fileId, sheetName, headerRow, fieldMapping, customValues, importMode, uniqueFields, blankCellMode, permSource } = params;
  if (!tableName || !fileId) {
    ctx.throw(400, "tableName and fileId are required");
  }
  const coll = ctx.db.getCollection(tableName);
  if (!coll) {
    ctx.throw(404, `Table ${tableName} not found`);
  }
  const perm = await (0, import_permission_check.checkImportPermission)(ctx, tableName, permSource);
  if (perm.importMode.length > 0 && !perm.importMode.includes(importMode)) {
    ctx.throw(403, `\u60A8\u7684\u6743\u9650\u4E0D\u5141\u8BB8\u4F7F\u7528\u300C${importMode}\u300D\u6A21\u5F0F\u5BFC\u5165\u6570\u636E\u8868\u300C${tableName}\u300D\uFF0C\u5141\u8BB8\u7684\u6A21\u5F0F\uFF1A${perm.importMode.join("\u3001")}`);
  }
  const allowedImportFields = perm.importFields || [];
  if (allowedImportFields.length > 0 && fieldMapping) {
    for (const tableField of Object.keys(fieldMapping)) {
      if (!allowedImportFields.includes(tableField)) {
        ctx.throw(403, `\u60A8\u7684\u6743\u9650\u4E0D\u5141\u8BB8\u5BFC\u5165\u5B57\u6BB5\u300C${tableField}\u300D\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458`);
      }
    }
  }
  const requiredPermFields = perm.requiredFields || [];
  if (requiredPermFields.length > 0 && fieldMapping) {
    for (const rf of requiredPermFields) {
      const mappedTo = fieldMapping[rf];
      if (!mappedTo || mappedTo === "__ignore__") {
        ctx.throw(400, `\u5FC5\u586B\u5B57\u6BB5\u300C${rf}\u300D\u672A\u5728\u5B57\u6BB5\u6620\u5C04\u4E2D\u914D\u7F6E`);
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
  var _a, _b, _c;
  const { tableName, sheetName, headerRow, fieldMapping, customValues, importMode, uniqueFields, blankCellMode, attachmentPath } = params;
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
  const coll = db.getCollection(tableName);
  const dateFieldNames = [];
  try {
    for (const f of Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || [])) {
      if (["date", "datetime", "datetimeTz", "unixTimestamp"].includes(f.type)) {
        dateFieldNames.push(f.name);
      }
    }
  } catch {
  }
  const normalizeDateValue = (val) => {
    if (!val || !val.trim()) return val;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    return val;
  };
  function applyBelongsToFK(record, vals, headers) {
    var _a2, _b2;
    const belongs = [];
    try {
      belongs.push(...Array.from(((_a2 = coll.fields) == null ? void 0 : _a2.values()) || []).filter(
        (f) => f.type === "belongsTo" && f.name !== "createdBy" && f.name !== "updatedBy"
      ));
    } catch {
    }
    for (const bf of belongs) {
      const fk = ((_b2 = bf.options) == null ? void 0 : _b2.foreignKey) || bf.name + "Id";
      const mappedVal = mapping[bf.name];
      if (mappedVal && mappedVal !== "__ignore__") {
        const colIdx = headers.indexOf(mappedVal);
        if (colIdx >= 0 && colIdx < vals.length) {
          record[fk] = vals[colIdx];
        }
        delete record[bf.name];
      }
    }
  }
  function makeRecord(vals, headers) {
    const record = {};
    for (const [tableField, excelCol] of Object.entries(mapping)) {
      if (!excelCol || excelCol === "__ignore__") continue;
      if (excelCol === "__custom__") {
        record[tableField] = String(custVals[tableField] ?? "");
        continue;
      }
      const colIndex = headers.indexOf(excelCol);
      if (colIndex >= 0 && colIndex < vals.length) {
        let raw = vals[colIndex];
        if (raw === void 0 || raw === null || raw === "") {
          if (bCellMode === "skip") continue;
          if (bCellMode === "null") {
            record[tableField] = null;
            continue;
          }
        }
        record[tableField] = String(raw !== void 0 && raw !== null ? raw : "");
      } else {
        record[tableField] = String(excelCol);
      }
    }
    return record;
  }
  function buildSnapshot(vals, headers) {
    const snap = {};
    Object.entries(mapping).forEach(([fieldName, excelCol]) => {
      if (excelCol && excelCol !== "__ignore__") {
        if (excelCol === "__custom__") {
          snap[fieldName + "=(\u81EA\u5B9A\u4E49)"] = custVals[fieldName] || "";
        } else {
          const idx = headers.indexOf(excelCol);
          if (idx >= 0 && idx < vals.length) snap[excelCol + "\u2192" + fieldName] = String(vals[idx] ?? "");
        }
      }
    });
    return JSON.stringify(snap).substring(0, 500);
  }
  function isEmptyRow(vals, headers) {
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
  const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || "storage/uploads";
  const filePath = import_path.default.join(storageDir, attachmentPath);
  if (!import_fs.default.existsSync(filePath)) {
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", "\u6587\u4EF6\u672A\u627E\u5230: " + filePath);
    await repo.update({ filterByTk: taskId, values: { status: "failed", errorMessage: "\u6587\u4EF6\u672A\u627E\u5230: " + filePath, completedAt: /* @__PURE__ */ new Date() } });
    return;
  }
  let errorLogs = [];
  let shadowTableName = "";
  try {
    await repo.update({ filterByTk: taskId, values: { status: "processing" } });
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u5F00\u59CB\u6267\u884C\u5BFC\u5165\u4EFB\u52A1");
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", `\u76EE\u6807\u6570\u636E\u8868: ${tableName}`);
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", `\u5BFC\u5165\u6A21\u5F0F: ${importMode || "insert"}`);
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E00\uFF1A\u6D41\u5F0F\u9884\u6821\u9A8C\u5F00\u59CB...");
    errorLogs = [];
    let phase1TotalRows = 0;
    let phase1Processed = 0;
    let phase1Headers = [];
    const seenUniqueValues = /* @__PURE__ */ new Set();
    let phase1Cancelled = false;
    const phase1Result = await new Promise((resolve) => {
      streamProcessExcel(filePath, sheetName, hRow, (rowNum, dataIdx, vals) => {
        if (import_cancel_state.cancelFlags.has(taskId)) {
          phase1Cancelled = true;
          return false;
        }
        if (dataIdx < 0) return true;
        if (isEmptyRow(vals, phase1Headers)) return true;
        phase1TotalRows++;
        phase1Processed++;
        const record = makeRecord(vals, phase1Headers);
        if ((importMode === "update" || importMode === "upsert") && uFields.length > 0) {
          const emptyUFields = uFields.filter((uf) => record[uf] === void 0 || record[uf] === "" || record[uf] === null);
          if (emptyUFields.length > 0) {
            if (errorLogs.length < 1e3) {
              errorLogs.push({
                row: dataIdx + 1,
                excelRow: rowNum,
                reason: `\u552F\u4E00\u503C\u5B57\u6BB5\u4E3A\u7A7A\uFF08${emptyUFields.join(", ")}\uFF09`,
                snapshot: buildSnapshot(vals, phase1Headers)
              });
            }
          } else {
            const ufKey = uFields.map((uf) => record[uf]).join("||");
            if (seenUniqueValues.has(ufKey)) {
              if (errorLogs.length < 1e3) {
                errorLogs.push({
                  row: dataIdx + 1,
                  excelRow: rowNum,
                  reason: `Excel \u5185\u90E8\u552F\u4E00\u503C\u91CD\u590D: ${uFields.join("+")} = ${ufKey}`,
                  snapshot: buildSnapshot(vals, phase1Headers)
                });
              }
            } else {
              seenUniqueValues.add(ufKey);
            }
          }
        }
        if (phase1Processed % 1e4 === 0) {
          try {
            repo.update({
              filterByTk: taskId,
              values: { progress: Math.min(50, Math.floor(phase1Processed / Math.max(phase1Processed, 1) * 50)) }
            });
          } catch {
          }
        }
        return true;
      }, (headers) => {
        phase1Headers = headers;
      }).then((result) => {
        if (phase1TotalRows === 0) phase1TotalRows = result.totalRows;
        resolve({ passed: !phase1Cancelled && errorLogs.length === 0 });
      });
    });
    if (phase1Cancelled) {
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF08\u9636\u6BB5\u4E00\uFF09");
      import_cancel_state.cancelFlags.delete(taskId);
      await repo.update({ filterByTk: taskId, values: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } });
      return;
    }
    await repo.update({ filterByTk: taskId, values: { totalRows: phase1TotalRows } });
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", `\u9636\u6BB5\u4E00\u9884\u6821\u9A8C\u5B8C\u6210\uFF0C\u5171 ${phase1TotalRows} \u884C\u6709\u6548\u6570\u636E`);
    if (!phase1Result.passed) {
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", `\u9636\u6BB5\u4E00\u9884\u6821\u9A8C\u5931\u8D25\uFF0C\u5171 ${errorLogs.length} \u4E2A\u9519\u8BEF`);
      await repo.update({
        filterByTk: taskId,
        values: { status: "failed", errorLogs, errorMessage: `\u9884\u6821\u9A8C\u5931\u8D25: ${errorLogs.length} \u4E2A\u9519\u8BEF`, completedAt: /* @__PURE__ */ new Date() }
      });
      return;
    }
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E8C\uFF1A\u5F71\u5B50\u8868\u5199\u5165\u5F00\u59CB...");
    shadowTableName = `_sjgl02_import_${taskId}`;
    const quotedMain = `"${tableName}"`;
    const quotedShadow = `"${shadowTableName}"`;
    try {
      await sequelize.query(`
        CREATE TABLE ${quotedShadow} (
          LIKE ${quotedMain}
          INCLUDING DEFAULTS
          INCLUDING CONSTRAINTS
          INCLUDING STORAGE
          INCLUDING COMMENTS
        )
      `);
      let idHasDefault = false;
      try {
        const [defRows] = await sequelize.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_name = '${shadowTableName}' AND column_name = 'id'
           AND column_default LIKE 'nextval%' AND table_schema = current_schema()`,
          { raw: true }
        );
        idHasDefault = defRows.length > 0;
      } catch {
      }
      let tempSeqName = "";
      if (!idHasDefault) {
        tempSeqName = `_sjgl02_temp_${taskId}_id_seq`;
        await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS "${tempSeqName}"`);
        await sequelize.query(`ALTER TABLE ${quotedShadow} ALTER COLUMN id SET DEFAULT nextval('${tempSeqName}')`);
        await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", `id \u65E0\u9ED8\u8BA4\u503C\uFF0C\u5DF2\u521B\u5EFA\u4E34\u65F6\u5E8F\u5217: ${tempSeqName}`);
      }
      const [colRows] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${shadowTableName}' AND table_schema = current_schema()
         ORDER BY ordinal_position`,
        { raw: true }
      );
      const allColumns = colRows.map((r) => r.column_name);
      const SYS_FIELDS = ["id", "createdAt", "updatedAt", "createdById", "updatedById"];
      const systemCols = new Set(SYS_FIELDS.filter((f) => !mapping[f] || mapping[f] === "__ignore__"));
      const nonIdColumns = allColumns.filter((c) => !systemCols.has(c));
      const quotedCols = nonIdColumns.map((c) => `"${c}"`).join(", ");
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", `\u5F71\u5B50\u8868\u5217: ${quotedCols}, \u6392\u9664: ${Array.from(systemCols).join(", ")}`);
      const allRowValues = [];
      let phase2Cancelled = false;
      await streamProcessExcel(filePath, sheetName, hRow, (rowNum, dataIdx, vals) => {
        if (import_cancel_state.cancelFlags.has(taskId)) {
          phase2Cancelled = true;
          return false;
        }
        if (dataIdx < 0) return true;
        if (isEmptyRow(vals, phase1Headers)) return true;
        const record = makeRecord(vals, phase1Headers);
        for (const fn of dateFieldNames) {
          const v = record[fn];
          if (typeof v === "string") record[fn] = normalizeDateValue(v);
        }
        if ((importMode === "update" || importMode === "upsert") && uFields.length > 0) {
          const allFilled = uFields.every((uf) => record[uf] !== void 0 && record[uf] !== "");
          if (!allFilled) return true;
        }
        const rowVals = nonIdColumns.map((c) => record[c] !== void 0 ? record[c] : null);
        allRowValues.push(rowVals);
        if (allRowValues.length % 1e3 === 0 && import_cancel_state.cancelFlags.has(taskId)) {
          phase2Cancelled = true;
          return false;
        }
        return true;
      }, (headers) => {
        if (phase1Headers.length === 0) phase1Headers = headers;
      }).then((result) => {
        phase1Headers = result.headers;
      });
      if (phase2Cancelled || import_cancel_state.cancelFlags.has(taskId)) {
        await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`);
        await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF08\u9636\u6BB5\u4E8C\uFF09");
        import_cancel_state.cancelFlags.delete(taskId);
        await repo.update({ filterByTk: taskId, values: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } });
        return;
      }
      const phase2TotalRows = allRowValues.length;
      const BATCH_SIZE = 5e3;
      async function insertBatch(batch) {
        const placeholders = batch.map(
          (_, ri) => `(${nonIdColumns.map((__, ci) => `$${ri * nonIdColumns.length + ci + 1}`).join(", ")})`
        ).join(", ");
        const flatValues = batch.flat();
        await sequelize.query(`INSERT INTO ${quotedShadow} (${quotedCols}) VALUES ${placeholders}`, { bind: flatValues });
      }
      async function insertWithSplit(batch, startOffset) {
        const errLogs = [];
        const SUB_SIZE = Math.max(500, Math.floor(batch.length / 10));
        if (SUB_SIZE >= batch.length) {
          for (let si = 0; si < batch.length; si++) {
            try {
              await insertBatch([batch[si]]);
            } catch (e) {
              const rowIdx = startOffset + si;
              const rowVals = batch[si];
              errLogs.push({
                row: rowIdx + 1,
                excelRow: (headerRow || 1) + rowIdx + 1,
                reason: e.message || String(e),
                snapshot: JSON.stringify(
                  nonIdColumns.reduce((acc, c, i) => {
                    acc[c] = rowVals[i];
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
              await insertBatch(sub);
            } catch {
              const subLogs = await insertWithSplit(sub, startOffset + si);
              errLogs.push(...subLogs);
              if (errLogs.length > 100) break;
            }
          }
        }
        return errLogs;
      }
      for (let bi = 0; bi < allRowValues.length; bi += BATCH_SIZE) {
        if (import_cancel_state.cancelFlags.has(taskId)) {
          await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`);
          await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF08\u9636\u6BB5\u4E8C\u5199\u5165\uFF09");
          import_cancel_state.cancelFlags.delete(taskId);
          await repo.update({ filterByTk: taskId, values: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } });
          return;
        }
        const batch = allRowValues.slice(bi, bi + BATCH_SIZE);
        try {
          await insertBatch(batch);
        } catch (batchErr) {
          await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", `\u6279\u6B21 ${bi + 1}-${bi + batch.length} \u5199\u5165\u5931\u8D25\uFF0C\u9010\u884C\u5B9A\u4F4D...`);
          const splitLogs = await insertWithSplit(batch, bi);
          if (splitLogs.length > 0) {
            errorLogs.push(...splitLogs);
            if (errorLogs.length > 1e3) errorLogs.splice(1e3);
            await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", `${splitLogs.length} \u884C\u5199\u5165\u5931\u8D25\uFF0C\u5DF2\u7EC8\u6B62`);
            await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`);
            await repo.update({
              filterByTk: taskId,
              values: { status: "failed", errorLogs, errorMessage: `\u9636\u6BB5\u4E8C\u5199\u5165\u5931\u8D25: ${splitLogs.length} \u884C\u6570\u636E\u5F02\u5E38`, completedAt: /* @__PURE__ */ new Date() }
            });
            return;
          }
        }
        const prog = 50 + Math.floor(bi * 40 / Math.max(allRowValues.length, 1));
        try {
          await repo.update({ filterByTk: taskId, values: { progress: Math.min(90, prog) } });
        } catch {
        }
      }
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", `\u9636\u6BB5\u4E8C\u5F71\u5B50\u8868\u5199\u5165\u5B8C\u6210\uFF0C\u5171 ${phase2TotalRows} \u884C`);
      await repo.update({ filterByTk: taskId, values: { progress: 90 } });
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E09\uFF1A\u539F\u5B50\u8FC1\u79FB\u5F00\u59CB...");
      try {
        await sequelize.query("SET SESSION statement_timeout = '30min'");
      } catch {
      }
      const transaction = await sequelize.transaction();
      let updatedCount = 0;
      try {
        if (importMode === "update") {
          const setClauses = [];
          for (const col of nonIdColumns) {
            if (bCellMode === "skip" && Object.values(mapping).some((v) => v === col)) {
              const stillMap = Object.entries(mapping).some(([tf, ec]) => {
                if (ec === "__ignore__" || ec === "__custom__") return false;
                if (ec === col) return true;
                const idx = phase1Headers.indexOf(ec);
                return idx >= 0 && phase1Headers[idx] === col;
              });
              if (stillMap) continue;
            }
            setClauses.push(`"${col}" = s."${col}"`);
          }
          const whereClauses = uFields.map((uf) => `m."${uf}" = s."${uf}"`).join(" AND ");
          for (const f of ["updatedAt", "updatedById"]) {
            if (!nonIdColumns.includes(f)) {
              setClauses.push(`"${f}" = COALESCE(s."${f}", ${f === "updatedAt" ? "NOW()" : (userId || "NULL") + "::bigint"})`);
            }
          }
          if (setClauses.length > 0 && whereClauses) {
            const [updateResult] = await sequelize.query(
              `UPDATE ${quotedMain} m SET ${setClauses.join(", ")} FROM ${quotedShadow} s WHERE ${whereClauses} RETURNING m.id`,
              { transaction }
            );
            updatedCount = updateResult.length;
            await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", `\u66F4\u65B0\u6A21\u5F0F\uFF1A\u5339\u914D ${updatedCount} \u884C\uFF0C\u5F71\u5B50\u8868\u5171 ${phase2TotalRows} \u884C`);
          }
        } else if (importMode === "upsert") {
          const setClauses = [];
          for (const col of nonIdColumns) {
            if (uFields.includes(col)) continue;
            if (bCellMode === "skip" && Object.values(mapping).some((v) => v === col)) continue;
            setClauses.push(`"${col}" = s."${col}"`);
          }
          const whereClauses = uFields.map((uf) => `m."${uf}" = s."${uf}"`).join(" AND ");
          for (const f of ["updatedAt", "updatedById"]) {
            if (!nonIdColumns.includes(f)) {
              setClauses.push(`"${f}" = COALESCE(s."${f}", ${f === "updatedAt" ? "NOW()" : (userId || "NULL") + "::bigint"})`);
            }
          }
          if (uFields.length > 0 && setClauses.length > 0) {
            await sequelize.query(
              `UPDATE ${quotedMain} m SET ${setClauses.join(", ")} FROM ${quotedShadow} s WHERE ${whereClauses}`,
              { transaction }
            );
            const nonIdQuotedCols2 = nonIdColumns.map((c) => `"${c}"`).join(", ");
            const notExistsWhere = uFields.map((uf) => `m."${uf}" = s."${uf}"`).join(" AND ");
            const sysIns2 = [];
            const sysSel2 = [];
            const SYS2 = ["createdAt", "updatedAt", "createdById", "updatedById"];
            for (const f of SYS2) {
              if (!nonIdColumns.includes(f)) {
                sysIns2.push(`"${f}"`);
                if (f === "createdAt" || f === "updatedAt") sysSel2.push("NOW()");
                else sysSel2.push(`${userId || "NULL"}::bigint`);
              }
            }
            await sequelize.query(
              `INSERT INTO ${quotedMain} (${nonIdQuotedCols2}${sysIns2.length ? ", " + sysIns2.join(", ") : ""}) SELECT ${nonIdQuotedCols2}${sysSel2.length ? ", " + sysSel2.join(", ") : ""} FROM ${quotedShadow} s WHERE NOT EXISTS (SELECT 1 FROM ${quotedMain} m WHERE ${notExistsWhere})`,
              { transaction }
            );
          } else {
            const nonIdQuotedCols2 = nonIdColumns.map((c) => `"${c}"`).join(", ");
            const sysIns3 = [];
            const sysSel3 = [];
            const SYS3 = ["createdAt", "updatedAt", "createdById", "updatedById"];
            for (const f of SYS3) {
              if (!nonIdColumns.includes(f)) {
                sysIns3.push(`"${f}"`);
                if (f === "createdAt" || f === "updatedAt") sysSel3.push("NOW()");
                else sysSel3.push(`${userId || "NULL"}::bigint`);
              }
            }
            await sequelize.query(
              `INSERT INTO ${quotedMain} (${nonIdQuotedCols2}${sysIns3.length ? ", " + sysIns3.join(", ") : ""}) SELECT ${nonIdQuotedCols2}${sysSel3.length ? ", " + sysSel3.join(", ") : ""} FROM ${quotedShadow}`,
              { transaction }
            );
          }
        } else {
          const hasId = mapping.id && mapping.id !== "__ignore__";
          const nonIdQuotedCols = nonIdColumns.map((c) => `"${c}"`).join(", ");
          const sysIns = [];
          const sysSel = [];
          const SYS = ["createdAt", "updatedAt", "createdById", "updatedById"];
          for (const f of SYS) {
            if (!nonIdColumns.includes(f)) {
              sysIns.push(`"${f}"`);
              if (f === "createdAt" || f === "updatedAt") sysSel.push("NOW()");
              else sysSel.push(`${userId || "NULL"}::bigint`);
            }
          }
          if (hasId) {
            await sequelize.query(
              `INSERT INTO ${quotedMain} (${nonIdQuotedCols}${sysIns.length ? ", " + sysIns.join(", ") : ""}) SELECT ${nonIdQuotedCols}${sysSel.length ? ", " + sysSel.join(", ") : ""} FROM ${quotedShadow}`,
              { transaction }
            );
          } else {
            await sequelize.query(
              `INSERT INTO ${quotedMain} (${nonIdQuotedCols}${sysIns.length ? ", " + sysIns.join(", ") : ""}) SELECT ${nonIdQuotedCols}${sysSel.length ? ", " + sysSel.join(", ") : ""} FROM ${quotedShadow}`,
              { transaction }
            );
          }
        }
        await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`, { transaction });
        await transaction.commit();
        if (importMode === "insert" && mapping.id && mapping.id !== "__ignore__") {
          try {
            const [seqRows] = await sequelize.query(
              `SELECT pg_get_serial_sequence('${tableName}', 'id') AS seq_name`,
              { raw: true }
            );
            const seqName = (_b = seqRows[0]) == null ? void 0 : _b.seq_name;
            if (seqName) {
              const [maxRows] = await sequelize.query(
                `SELECT COALESCE(MAX(id), 0) AS max_id FROM ${quotedMain}`,
                { raw: true }
              );
              const maxId = parseInt(((_c = maxRows[0]) == null ? void 0 : _c.max_id) || "0", 10);
              await sequelize.query(`SELECT setval('${seqName}', ${maxId + 1})`);
            }
          } catch {
          }
        }
        if (tempSeqName) {
          try {
            await sequelize.query(`DROP SEQUENCE IF EXISTS "${tempSeqName}"`);
          } catch {
          }
        }
        const successMsg = importMode === "update" ? `\u8FC1\u79FB\u5B8C\u6210\uFF0C\u66F4\u65B0 ${updatedCount} \u884C\uFF0C\u5F71\u5B50\u8868\u5DF2\u5220\u9664` : `\u8FC1\u79FB\u5B8C\u6210\uFF0C\u5171 ${phase2TotalRows} \u884C\uFF0C\u5F71\u5B50\u8868\u5DF2\u5220\u9664`;
        await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", successMsg);
        await repo.update({
          filterByTk: taskId,
          values: { status: "completed", progress: 100, processedRows: phase2TotalRows, completedAt: /* @__PURE__ */ new Date() }
        });
      } catch (migrateErr) {
        await transaction.rollback();
        try {
          await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`);
        } catch {
        }
        throw migrateErr;
      }
    } catch (phase2Err) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS ${quotedShadow}`);
      } catch {
      }
      throw phase2Err;
    }
  } catch (err) {
    try {
      const fallbackLogs = errorLogs.length > 0 ? errorLogs : [{ reason: err.message || String(err), snapshot: JSON.stringify({ shadowTable: shadowTableName || "?", phase: "\u9636\u6BB5\u4E8C\u5199\u5165" }).substring(0, 500) }];
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", `\u5BFC\u5165\u5F02\u5E38: ${err.message || String(err)}`);
      await repo.update({
        filterByTk: taskId,
        values: { status: "failed", errorMessage: err.message || String(err), errorLogs: fallbackLogs, completedAt: /* @__PURE__ */ new Date() }
      });
    } catch {
    }
  } finally {
    import_cancel_state.cancelFlags.delete(taskId);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  executeImport,
  getTableFields,
  preview,
  uploadParse
});
