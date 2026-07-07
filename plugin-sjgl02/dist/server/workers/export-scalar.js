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
var export_scalar_exports = {};
__export(export_scalar_exports, {
  exportScalarTable: () => exportScalarTable
});
module.exports = __toCommonJS(export_scalar_exports);
var import_exceljs = __toESM(require("exceljs"));
var import_export_worker_utils = require("./export-worker-utils");
const PAGE_SIZE = 2e3;
const PROGRESS_INTERVAL = 3e4;
async function exportScalarTable(options) {
  console.error("[export-scalar] exportScalarTable started");
  const {
    sequelize,
    tableName,
    fieldNames,
    fieldHeaders,
    collDisplayName,
    pkStrategy,
    pkField,
    collectionTotal,
    tempDir,
    fileNameTemplate,
    send,
    isCancelled
  } = options;
  const path = await import("path");
  const safeName = collDisplayName.substring(0, 31).replace(/[\\/:*?[\]]/g, "_");
  const baseName = fileNameTemplate ? fileNameTemplate.replace(/\{表名\}/g, tableName).replace(/\{日期\}/g, (0, import_export_worker_utils.formatDateToken)()) : `sjgl02_export_${tableName}_${Date.now()}`;
  const xlsxName = `${baseName}.xlsx`;
  const filePath = path.join(tempDir, xlsxName);
  console.error("[export-scalar] creating workbook writer", filePath);
  const streamWriter = new import_exceljs.default.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false
  });
  console.error("[export-scalar] workbook writer created");
  streamWriter.creator = "NocoBase @my-project/plugin-sjgl02";
  const sheet = streamWriter.addWorksheet(safeName);
  console.error("[export-scalar] worksheet added", safeName);
  sheet.columns = fieldNames.map((f) => ({
    header: fieldHeaders[f] || f,
    key: f,
    width: Math.max((fieldHeaders[f] || f).length + 4, 20)
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
  const quotedTable = (0, import_export_worker_utils.quoteIdentifier)(tableName);
  const quotedFields = fieldNames.map((f) => (0, import_export_worker_utils.quoteIdentifier)(f)).join(", ");
  const selectFields = fieldNames.length > 0 ? quotedFields : "*";
  const effectivePkField = pkStrategy !== "offset" ? pkField : null;
  let processedRows = 0;
  let lastProgressAt = Date.now();
  const mainIds = /* @__PURE__ */ new Set();
  let lastValue = null;
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    if (await isCancelled()) {
      throw new Error("cancelled");
    }
    const { sql, bind } = (0, import_export_worker_utils.buildPageSql)(quotedTable, selectFields, pkField, pkStrategy, lastValue, offset, PAGE_SIZE);
    console.error("[export-scalar] query sql", sql, bind);
    const [rows] = await sequelize.query(sql, { bind });
    console.error("[export-scalar] query rows", rows.length);
    if (rows.length === 0) {
      hasMore = false;
      continue;
    }
    for (const row of rows) {
      const excelRow = {};
      for (const f of fieldNames) {
        excelRow[f] = (0, import_export_worker_utils.formatValue)(row[f]);
      }
      sheet.addRow(excelRow).commit();
      processedRows++;
      if (effectivePkField && row[effectivePkField] !== void 0) {
        mainIds.add(row[effectivePkField]);
      }
    }
    if (pkStrategy === "cursor" || pkStrategy === "uuid") {
      lastValue = rows[rows.length - 1][pkField];
    } else {
      offset += PAGE_SIZE;
      if (offset >= collectionTotal) hasMore = false;
    }
    if (Date.now() - lastProgressAt >= PROGRESS_INTERVAL) {
      const pct = Math.min(100, Math.floor(processedRows / Math.max(1, collectionTotal) * 100));
      send({ type: "progress", processedRows, totalRows: collectionTotal, progress: pct });
      send({ type: "heartbeat", ts: Date.now() });
      lastProgressAt = Date.now();
    }
    if (rows.length < PAGE_SIZE) hasMore = false;
  }
  sheet.commit();
  return { filePath, processedRows, mainIds: Array.from(mainIds), streamWriter };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  exportScalarTable
});
