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
var excel_parser_exports = {};
__export(excel_parser_exports, {
  ROW_LIMITS: () => ROW_LIMITS,
  countDataRows: () => countDataRows,
  detectFileKind: () => detectFileKind,
  iterateRows: () => iterateRows,
  listSheets: () => listSheets,
  readPreview: () => readPreview,
  yieldEventLoop: () => yieldEventLoop
});
module.exports = __toCommonJS(excel_parser_exports);
var import_node_fs = __toESM(require("node:fs"));
var import_exceljs = __toESM(require("exceljs"));
var XLSX = __toESM(require("xlsx"));
function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}
const ROW_LIMITS = {
  xlsx: 5e5,
  xls: 2e5,
  csv: 5e5
};
function detectFileKind(fileName) {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  if (ext === "csv") return "csv";
  return null;
}
function normalizeCell(cell) {
  if (cell === null || cell === void 0) return null;
  if (typeof cell === "object") {
    const anyCell = cell;
    if (anyCell.richText) {
      return anyCell.richText.map((t) => t.text).join("");
    }
    if ("result" in anyCell) return anyCell.result ?? null;
    if (cell instanceof Date) return cell;
    if ("text" in anyCell) return anyCell.text ?? null;
    return String(cell);
  }
  return cell;
}
function rowToArray(rowValues) {
  if (!Array.isArray(rowValues)) return [];
  return rowValues.slice(1).map(normalizeCell);
}
function padRow(values, length) {
  const out = values.slice(0, length);
  while (out.length < length) out.push(null);
  return out;
}
async function withRetry(fn, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
    }
  }
  throw lastError;
}
async function listXlsxSheets(filePath) {
  return withRetry(async () => {
    const reader = new import_exceljs.default.stream.xlsx.WorkbookReader(filePath, {
      entries: "emit",
      sharedStrings: "cache",
      hyperlinks: "ignore",
      styles: "ignore",
      worksheets: "emit"
    });
    const sheets = [];
    for await (const worksheet of reader) {
      const ws = worksheet;
      sheets.push({ name: ws.name, rowCount: ws.actualRowCount || ws.rowCount });
    }
    return sheets;
  });
}
function readBook(filePath, kind) {
  if (kind === "csv") {
    const content = import_node_fs.default.readFileSync(filePath, "utf8");
    return XLSX.read(content, { type: "string", cellDates: true });
  }
  return XLSX.readFile(filePath, { cellDates: true });
}
function sheetRows(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false
  });
}
async function listSheets(filePath, kind) {
  if (kind === "xlsx") return listXlsxSheets(filePath);
  const workbook = readBook(filePath, kind);
  return workbook.SheetNames.map((name) => ({
    name,
    rowCount: sheetRows(workbook, name).length
  }));
}
async function readPreview(filePath, kind, sheetName, headerRow, limit = 10) {
  if (kind === "xlsx") {
    return withRetry(async () => {
      let headers2 = [];
      const rows = [];
      let totalRows = 0;
      const reader = new import_exceljs.default.stream.xlsx.WorkbookReader(filePath, {
        entries: "emit",
        sharedStrings: "cache",
        hyperlinks: "ignore",
        styles: "ignore",
        worksheets: "emit"
      });
      for await (const worksheet of reader) {
        const ws = worksheet;
        if (ws.name !== sheetName) continue;
        for await (const row of worksheet) {
          if (row.number === headerRow) {
            headers2 = rowToArray(row.values).map((v) => v === null || v === void 0 ? "" : String(v));
          } else if (row.number > headerRow) {
            totalRows += 1;
            if (rows.length < limit) rows.push(rowToArray(row.values));
          }
        }
        break;
      }
      const width = headers2.length;
      return { headers: headers2, rows: rows.map((r) => padRow(r, width)), totalRows };
    });
  }
  const workbook = readBook(filePath, kind);
  const allRows = sheetRows(workbook, sheetName);
  const headerIdx = Math.max(headerRow - 1, 0);
  const headers = (allRows[headerIdx] || []).map(
    (v) => v === null || v === void 0 ? "" : String(v)
  );
  const dataRows = allRows.slice(headerIdx + 1);
  return {
    headers,
    rows: dataRows.slice(0, limit).map((r) => padRow(r, headers.length)),
    totalRows: dataRows.length
  };
}
async function* iterateRows(filePath, kind, sheetName, headerRow) {
  if (kind === "xlsx") {
    let width2 = 0;
    const reader = new import_exceljs.default.stream.xlsx.WorkbookReader(filePath, {
      entries: "emit",
      sharedStrings: "cache",
      hyperlinks: "ignore",
      styles: "ignore",
      worksheets: "emit"
    });
    for await (const worksheet of reader) {
      const ws = worksheet;
      if (ws.name !== sheetName) continue;
      for await (const row of worksheet) {
        if (row.number === headerRow) {
          width2 = rowToArray(row.values).length;
          continue;
        }
        if (row.number < headerRow) continue;
        const values = rowToArray(row.values);
        if (values.every((v) => v === null || v === "")) continue;
        yield { rowNumber: row.number, values: padRow(values, width2) };
      }
      break;
    }
    return;
  }
  const workbook = readBook(filePath, kind);
  const allRows = sheetRows(workbook, sheetName);
  const headerIdx = Math.max(headerRow - 1, 0);
  const width = (allRows[headerIdx] || []).length;
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const values = allRows[i];
    if (!values || values.every((v) => v === null || v === "")) continue;
    yield { rowNumber: i + 1, values: padRow(values, width) };
  }
}
async function countDataRows(filePath, kind, sheetName, headerRow) {
  let count = 0;
  for await (const _row of iterateRows(filePath, kind, sheetName, headerRow)) {
    count += 1;
  }
  return count;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ROW_LIMITS,
  countDataRows,
  detectFileKind,
  iterateRows,
  listSheets,
  readPreview,
  yieldEventLoop
});
