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
var XLSX = __toESM(require("xlsx"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
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
    return {
      name: f.name,
      type: f.type,
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
    const workbook = XLSX.readFile(filePath, { type: "file" });
    const sheets = workbook.SheetNames;
    const targetSheet = sheetName || sheets[0];
    const ws = workbook.Sheets[targetSheet];
    if (!ws) {
      ctx.throw(400, `Sheet "${targetSheet}" not found`);
    }
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const hRow = Math.max(0, (parseInt(String(headerRow), 10) || 1) - 1);
    const headerColumns = (allRows[hRow] || []).map((h) => String(h));
    const dataRows = allRows.slice(hRow + 1).filter((r) => r.some((c) => c !== ""));
    const previewRows = dataRows.slice(0, 10).map((row) => {
      const obj = {};
      headerColumns.forEach((h, i2) => {
        obj[h] = row[i2] !== void 0 ? row[i2] : "";
      });
      return obj;
    });
    ctx.body = {
      sheets,
      headerColumns,
      fileId,
      fileName: attachment.filename || attachment.title,
      previewRows,
      totalRows: dataRows.length
    };
  } catch (err) {
    if (err.status) throw err;
    ctx.throw(500, "Failed to parse file: " + err.message);
  }
  await next();
}
async function preview(ctx, next) {
  var _a, _b, _c, _d;
  const p = ctx.action.params;
  const fileId = p.fileId || ((_a = ctx.request.query) == null ? void 0 : _a.fileId) || ((_b = ctx.query) == null ? void 0 : _b.fileId);
  const sheetName = p.sheetName || ((_c = ctx.request.query) == null ? void 0 : _c.sheetName);
  const headerRow = p.headerRow || ((_d = ctx.request.query) == null ? void 0 : _d.headerRow);
  if (!fileId) {
    ctx.throw(400, "fileId is required");
  }
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
    const hRow = Math.max(0, (parseInt(String(headerRow), 10) || 1) - 1);
    const headers = (allRows[hRow] || []).map((h) => String(h));
    const dataRows = allRows.slice(hRow + 1).filter((r) => r.some((c) => c !== ""));
    const previewRows = dataRows.slice(0, 10).map((row) => {
      const obj = {};
      headers.forEach((h, i2) => {
        obj[h] = row[i2] !== void 0 ? row[i2] : "";
      });
      return obj;
    });
    ctx.body = {
      preview: previewRows,
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
  var _a, _b;
  const params = ctx.action.params.values || ctx.action.params;
  const { tableName, fileId, sheetName, headerRow, fieldMapping, customValues, importMode, uniqueFields } = params;
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
      status: "pending",
      fieldMapping: fieldMapping || {},
      customValues: customValues || {},
      importMode: importMode || "insert",
      sheetName: sheetName || "Sheet1",
      headerRow: headerRow || 1,
      importFileId: fileId,
      uniqueFields: uniqueFields || [],
      totalRows: 0,
      progress: 0,
      createdById: (_a = ctx.state.currentUser) == null ? void 0 : _a.id
    }
  });
  const sequelize = ctx.db.sequelize;
  const transaction = await sequelize.transaction();
  await repo.update({ filterByTk: task.id, values: { status: "processing" }, transaction });
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
    const hRow = Math.max(0, (parseInt(String(headerRow), 10) || 1) - 1);
    const headers = (allRows[hRow] || []).map((h) => String(h));
    const dataRows = allRows.slice(hRow + 1).filter((r) => r.some((c) => c !== ""));
    const mapping = fieldMapping || {};
    const custVals = customValues || {};
    const totalRows = dataRows.length;
    await repo.update({ filterByTk: task.id, values: { totalRows }, transaction });
    const targetRepo = ctx.db.getRepository(tableName);
    const errorLogs = [];
    let processedRows = 0;
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
    const dateFieldNames = [];
    try {
      for (const f of Array.from(((_b = coll.fields) == null ? void 0 : _b.values()) || [])) {
        if (["date", "datetime", "datetimeTz", "unixTimestamp"].includes(f.type)) {
          dateFieldNames.push(f.name);
        }
      }
    } catch {
    }
    const makeRecord = (row) => {
      const record = {};
      for (const [tableField, excelCol] of Object.entries(mapping)) {
        if (!excelCol || excelCol === "__ignore__") continue;
        if (excelCol === "__custom__") {
          record[tableField] = String(custVals[tableField] ?? "");
          continue;
        }
        const colIndex = headers.indexOf(excelCol);
        if (colIndex >= 0 && colIndex < row.length) {
          record[tableField] = String(row[colIndex] !== void 0 && row[colIndex] !== null ? row[colIndex] : "");
        } else {
          record[tableField] = String(excelCol);
        }
      }
      return record;
    };
    const buildSnapshot = (row) => {
      const snap = {};
      Object.entries(mapping).forEach(([fieldName, excelCol]) => {
        if (excelCol && excelCol !== "__ignore__") {
          if (excelCol === "__custom__") {
            snap[fieldName + "=(\u81EA\u5B9A\u4E49)"] = custVals[fieldName] || "";
          } else {
            const idx = headers.indexOf(excelCol);
            if (idx >= 0 && idx < row.length) snap[excelCol + "\u2192" + fieldName] = String(row[idx] ?? "");
          }
        }
      });
      return JSON.stringify(snap).substring(0, 500);
    };
    const applyBelongsToFK = (record) => {
      var _a2, _b2;
      const belonegs = [];
      try {
        belonegs.push(...Array.from(((_a2 = coll.fields) == null ? void 0 : _a2.values()) || []).filter((f) => f.type === "belongsTo" && f.name !== "createdBy" && f.name !== "updatedBy"));
      } catch {
      }
      for (const bf of belonegs) {
        const fk = ((_b2 = bf.options) == null ? void 0 : _b2.foreignKey) || bf.name + "Id";
        const mappedVal = mapping[bf.name];
        if (mappedVal && mappedVal !== "__ignore__") {
          const colIdx = headers.indexOf(mappedVal);
          if (colIdx >= 0 && colIdx < dataRows[i].length) {
            record[fk] = dataRows[i][colIdx];
          }
          delete record[bf.name];
        }
      }
    };
    const processedUniques = /* @__PURE__ */ new Set();
    for (let i2 = 0; i2 < dataRows.length; i2++) {
      const rowIndex = i2 + 1;
      try {
        const record = makeRecord(dataRows[i2]);
        for (const fn of dateFieldNames) {
          const v = record[fn];
          if (typeof v === "string") record[fn] = normalizeDateValue(v);
        }
        if ((importMode === "update" || importMode === "upsert") && uniqueFields.length > 0) {
          const allFilled = uniqueFields.every((uf) => record[uf] !== void 0 && record[uf] !== "");
          if (allFilled) {
            const ufKey = uniqueFields.map((uf) => String(record[uf] || "")).join("||");
            if (processedUniques.has(ufKey)) {
              errorLogs.push({
                row: rowIndex,
                excelRow: (headerRow || 1) + rowIndex - 1,
                reason: `\u552F\u4E00\u503C\u5B57\u6BB5\u7EC4\u5408\u91CD\u590D / Duplicate unique fields: ${uniqueFields.join("+")} = ${ufKey}`,
                snapshot: buildSnapshot(dataRows[i2])
              });
              continue;
            }
            processedUniques.add(ufKey);
          }
        }
        if (importMode === "update" || importMode === "upsert") {
          const uFields = uniqueFields || [];
          if (uFields.length === 0) {
            if (importMode === "update") {
              errorLogs.push({
                row: rowIndex,
                excelRow: (headerRow || 1) + rowIndex - 1,
                reason: "\u66F4\u65B0\u6A21\u5F0F\u672A\u914D\u7F6E\u552F\u4E00\u503C\u5B57\u6BB5\uFF0C\u65E0\u6CD5\u5339\u914D\u5DF2\u6709\u8BB0\u5F55",
                snapshot: buildSnapshot(dataRows[i2])
              });
              continue;
            }
          } else {
            const filter = {};
            for (const uf of uFields) {
              if (record[uf] !== void 0) filter[uf] = record[uf];
            }
            if (Object.keys(filter).length > 0) {
              const [existingRecords, matchCount] = await targetRepo.findAndCount({ filter, limit: 2, transaction });
              if (matchCount > 1) {
                errorLogs.push({
                  row: rowIndex,
                  excelRow: (headerRow || 1) + rowIndex - 1,
                  reason: `\u552F\u4E00\u503C\u5339\u914D\u5230 ${matchCount} \u6761\u8BB0\u5F55\uFF0C\u65E0\u6CD5\u786E\u5B9A\u66F4\u65B0\u76EE\u6807 (Ambiguous: ${matchCount} records matched unique fields)`,
                  snapshot: buildSnapshot(dataRows[i2])
                });
                continue;
              }
              if (matchCount === 1) {
                applyBelongsToFK(record);
                await targetRepo.update({ filterByTk: existingRecords[0].id, values: record, transaction, context: ctx });
                processedRows++;
                continue;
              }
            } else {
              if (importMode === "update") {
                errorLogs.push({
                  row: rowIndex,
                  excelRow: (headerRow || 1) + rowIndex - 1,
                  reason: "\u552F\u4E00\u503C\u5B57\u6BB5\u5728\u6570\u636E\u884C\u4E2D\u672A\u627E\u5230\u503C\uFF0C\u65E0\u6CD5\u5339\u914D",
                  snapshot: buildSnapshot(dataRows[i2])
                });
                continue;
              }
            }
          }
        }
        if (importMode === "insert" || importMode === "upsert") {
          applyBelongsToFK(record);
          await targetRepo.create({ values: record, transaction, context: ctx });
          processedRows++;
        } else if (importMode === "update") {
          errorLogs.push({
            row: rowIndex,
            excelRow: (headerRow || 1) + rowIndex - 1,
            reason: "\u672A\u5339\u914D\u5230\u5DF2\u6709\u8BB0\u5F55\uFF08\u66F4\u65B0\u6A21\u5F0F\uFF09",
            snapshot: buildSnapshot(dataRows[i2])
          });
        }
      } catch (rowErr) {
        errorLogs.push({
          row: rowIndex,
          excelRow: (headerRow || 1) + rowIndex - 1,
          reason: rowErr.message || String(rowErr),
          snapshot: buildSnapshot(dataRows[i2])
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
          proces