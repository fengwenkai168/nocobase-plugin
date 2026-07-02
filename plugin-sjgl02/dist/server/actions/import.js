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
var import_permission_check = require("./permission-check");
var import_taskLogs = require("./taskLogs");
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
      headerColumns.forEach((h, i) => {
        obj[h] = row[i] !== void 0 ? row[i] : "";
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
    const previewRows = dataRows.slice(0, previewLimit).map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== void 0 ? row[i] : "";
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
  const sequelize = ctx.db.sequelize;
  const transaction = await sequelize.transaction();
  await repo.update({ filterByTk: task.id, values: { status: "processing" }, transaction });
  await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "INFO", "\u5F00\u59CB\u6267\u884C\u5BFC\u5165\u4EFB\u52A1");
  await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "INFO", `\u76EE\u6807\u6570\u636E\u8868: ${tableName}`);
  await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "INFO", `\u5BFC\u5165\u6A21\u5F0F: ${importMode || "insert"}`);
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
    await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "SUCC", `\u6587\u4EF6\u89E3\u6790\u5B8C\u6210\uFF0C\u5171 ${totalRows} \u884C\u6709\u6548\u6570\u636E`);
    await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "INFO", `\u5F00\u59CB\u9010\u884C\u5904\u7406\u6570\u636E...`);
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
          const raw = row[colIndex];
          if (raw === void 0 || raw === null || raw === "") {
            if (blankCellMode === "skip") continue;
            if (blankCellMode === "null") {
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
    const applyBelongsToFK = (record, rowIdx) => {
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
          if (colIdx >= 0 && colIdx < dataRows[rowIdx].length) {
            record[fk] = dataRows[rowIdx][colIdx];
          }
          delete record[bf.name];
        }
      }
    };
    const processedUniques = /* @__PURE__ */ new Set();
    if ((importMode === "update" || importMode === "upsert") && ((uniqueFields == null ? void 0 : uniqueFields.length) || 0) > 0) {
      for (let i = 0; i < dataRows.length; i++) {
        const testRecord = makeRecord(dataRows[i]);
        const emptyFields = (uniqueFields || []).filter(
          (uf) => testRecord[uf] === void 0 || testRecord[uf] === "" || testRecord[uf] === null
        );
        if (emptyFields.length > 0) {
          errorLogs.push({
            row: i + 1,
            excelRow: (headerRow || 1) + i,
            reason: `\u552F\u4E00\u503C\u5B57\u6BB5\u4E3A\u7A7A\uFF08${emptyFields.join(", ")}\uFF09\uFF0C\u6574\u6279\u5BFC\u5165\u5DF2\u53D6\u6D88`,
            snapshot: buildSnapshot(dataRows[i])
          });
          await repo.update({ filterByTk: task.id, values: { status: "failed", errorLogs, processedRows: 0, totalRows: dataRows.length } }, { transaction });
          await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "ERROR", `\u7B2C ${i + 1} \u884C\u552F\u4E00\u503C\u5B57\u6BB5\uFF08${emptyFields.join(", ")}\uFF09\u4E3A\u7A7A\uFF0C\u5DF2\u56DE\u6EDA\u5168\u90E8 ${dataRows.length} \u884C\u6570\u636E`);
          await transaction.rollback();
          ctx.body = { success: false, taskId: task.id, error: `\u552F\u4E00\u503C\u5B57\u6BB5\u4E3A\u7A7A\uFF1A${emptyFields.join(", ")}\uFF08\u7B2C ${i + 1} \u884C\uFF09` };
          return;
        }
      }
    }
    const BATCH_SIZE = 1e3;
    for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, dataRows.length);
      const batchRows = dataRows.slice(batchStart, batchEnd);
      const batchRecords = [];
      for (let bi = 0; bi < batchRows.length; bi++) {
        const rowData = batchRows[bi];
        const i = batchStart + bi;
        const record = makeRecord(rowData);
        for (const fn of dateFieldNames) {
          const v = record[fn];
          if (typeof v === "string") record[fn] = normalizeDateValue(v);
        }
        batchRecords.push({ idx: i, record, rowData });
      }
      if ((importMode === "update" || importMode === "upsert") && ((uniqueFields == null ? void 0 : uniqueFields.length) || 0) > 0) {
        const batchFilters = [];
        const validIdx = [];
        for (const br of batchRecords) {
          const allFilled = (uniqueFields || []).every((uf) => br.record[uf] !== void 0 && br.record[uf] !== "");
          if (!allFilled) continue;
          const ufKey = (uniqueFields || []).map((uf) => String(br.record[uf] || "")).join("||");
          if (processedUniques.has(ufKey)) {
            errorLogs.push({
              row: br.idx + 1,
              excelRow: (headerRow || 1) + br.idx,
              reason: `\u552F\u4E00\u503C\u5B57\u6BB5\u7EC4\u5408\u91CD\u590D: ${(uniqueFields || []).join("+")} = ${ufKey}`,
              snapshot: buildSnapshot(br.rowData)
            });
            continue;
          }
          processedUniques.add(ufKey);
          const filter = {};
          for (const uf of uniqueFields || []) {
            if (br.record[uf] !== void 0 && br.record[uf] !== "") filter[uf] = br.record[uf];
          }
          if (Object.keys(filter).length > 0) {
            batchFilters.push(filter);
            validIdx.push(br.idx);
          }
        }
        if (batchFilters.length > 0) {
          const allExisting = await targetRepo.find({
            filter: { $or: batchFilters },
            limit: batchFilters.length * 2,
            transaction
          });
          for (let fi = 0; fi < validIdx.length; fi++) {
            const br = batchRecords.find((b) => b.idx === validIdx[fi]);
            if (!br) continue;
            const filter = batchFilters[fi];
            const matched = allExisting.filter((er) => {
              return Object.keys(filter).every((k) => er[k] !== void 0 && String(er[k]) === String(filter[k]));
            });
            if (matched.length > 1) {
              errorLogs.push({
                row: br.idx + 1,
                excelRow: (headerRow || 1) + br.idx,
                reason: `\u552F\u4E00\u503C\u5339\u914D\u5230 ${matched.length} \u6761\u8BB0\u5F55`,
                snapshot: buildSnapshot(br.rowData)
              });
            } else if (matched.length === 1) {
              br.record._existingId = matched[0].id;
            }
          }
        }
      }
      const toCreateRows = [];
      const toUpdatePromises = [];
      for (const br of batchRecords) {
        const rowIndex = br.idx + 1;
        try {
          const record = br.record;
          if (record._existingId !== void 0) {
            const eid = record._existingId;
            delete record._existingId;
            applyBelongsToFK(record, br.idx);
            toUpdatePromises.push((async () => {
              await targetRepo.update({ filterByTk: eid, values: record, transaction, context: ctx });
              processedRows++;
            })());
            continue;
          }
          if ((importMode === "update" || importMode === "upsert") && ((uniqueFields == null ? void 0 : uniqueFields.length) || 0) > 0) {
            const uFields = uniqueFields || [];
            if (uFields.length === 0) {
              if (importMode === "update") {
                errorLogs.push({ row: rowIndex, excelRow: (headerRow || 1) + br.idx, reason: "\u66F4\u65B0\u6A21\u5F0F\u672A\u914D\u7F6E\u552F\u4E00\u503C\u5B57\u6BB5" });
                continue;
              }
            }
            if (importMode === "update") {
              errorLogs.push({ row: rowIndex, excelRow: (headerRow || 1) + br.idx, reason: "\u672A\u5339\u914D\u5230\u5DF2\u6709\u8BB0\u5F55\uFF08\u66F4\u65B0\u6A21\u5F0F\uFF09" });
              continue;
            }
          }
          if (importMode === "insert" || importMode === "upsert") {
            applyBelongsToFK(record, br.idx);
            toCreateRows.push(record);
            processedRows++;
          }
        } catch (rowErr) {
          errorLogs.push({ row: rowIndex, excelRow: (headerRow || 1) + br.idx, reason: rowErr.message || String(rowErr), snapshot: buildSnapshot(br.rowData) });
        }
      }
      if (toCreateRows.length > 0) {
        try {
          await targetRepo.create({ values: toCreateRows, transaction, context: ctx });
        } catch (createErr) {
          for (const cr of toCreateRows) {
            errorLogs.push({ reason: createErr.message || String(createErr) });
          }
        }
      }
      await Promise.all(toUpdatePromises);
      const batchProgress = Math.min(100, Math.floor(batchEnd * 100 / dataRows.length));
      try {
        await repo.update({ filterByTk: task.id, values: { processedRows, progress: batchProgress }, transaction });
      } catch {
      }
    }
    if (errorLogs.length > 0) {
      await transaction.rollback();
      await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "WARN", `\u5171 ${errorLogs.length} \u884C\u6570\u636E\u5931\u8D25\uFF0C\u6B63\u5728\u56DE\u6EDA...`);
      await repo.update({
        filterByTk: task.id,
        values: {
          status: "failed",
          progress: 0,
          processedRows: 0,
          errorLogs,
          errorMessage: `${errorLogs.length} \u884C\u6570\u636E\u5931\u8D25\uFF0C\u4E8B\u52A1\u5DF2\u56DE\u6EDA`,
          completedAt: /* @__PURE__ */ new Date()
        }
      });
      await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "ERROR", `\u5BFC\u5165\u5931\u8D25: ${errorLogs.length} \u884C\u6570\u636E\u5931\u8D25\uFF0C\u5DF2\u56DE\u6EDA`);
    } else {
      await transaction.commit();
      await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "SUCC", `\u5BFC\u5165\u5B8C\u6210\uFF0C\u5171 ${processedRows} \u884C\u6570\u636E`);
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
    await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "ERROR", `\u5BFC\u5165\u5F02\u5E38: ${err.message || String(err)}`);
    await (0, import_taskLogs.writeTaskLog)(ctx, task.id, "WARN", "\u4E8B\u52A1\u5DF2\u56DE\u6EDA\uFF0C\u6570\u636E\u5DF2\u8FD8\u539F");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  executeImport,
  getTableFields,
  preview,
  uploadParse
});
