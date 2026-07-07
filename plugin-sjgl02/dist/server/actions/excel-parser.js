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
  streamProcessExcel: () => streamProcessExcel
});
module.exports = __toCommonJS(excel_parser_exports);
var import_exceljs = __toESM(require("exceljs"));
async function streamProcessExcel(filePath, targetSheet, headerRow, onRow, onHeader) {
  const wb = new import_exceljs.default.Workbook();
  await wb.xlsx.readFile(filePath);
  let ws;
  if (targetSheet) {
    ws = wb.getWorksheet(targetSheet);
    if (!ws) ws = wb.worksheets[0];
  } else {
    ws = wb.worksheets[0];
  }
  if (!ws) {
    throw new Error("\u5DE5\u4F5C\u8868\u672A\u627E\u5230: " + (targetSheet || "\u9ED8\u8BA4\u5DE5\u4F5C\u8868"));
  }
  const hRowNum = headerRow || 1;
  let headers = [];
  let dataIndex = 0;
  let totalRows = 0;
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const rowValues = row.values || [];
    if (rowNum < hRowNum) return;
    if (rowNum === hRowNum) {
      headers = rowValues.slice(1).map((h) => String(h ?? ""));
      if (onHeader) onHeader(headers);
      return;
    }
    const vals = rowValues.slice(1);
    const empty = !vals.some((v) => v !== void 0 && v !== null && v !== "");
    if (empty) {
      dataIndex++;
      return;
    }
    totalRows++;
    const shouldContinue = onRow(rowNum, dataIndex, vals);
    if (shouldContinue === false) return false;
    dataIndex++;
  });
  return { headers, totalRows };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  streamProcessExcel
});
