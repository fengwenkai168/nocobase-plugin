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
var export_worker_utils_exports = {};
__export(export_worker_utils_exports, {
  buildExportZip: () => buildExportZip,
  buildPageSql: () => buildPageSql,
  formatDateToken: () => formatDateToken,
  formatValue: () => formatValue,
  quoteIdentifier: () => quoteIdentifier,
  resolveExportBaseName: () => resolveExportBaseName
});
module.exports = __toCommonJS(export_worker_utils_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
function formatValue(val) {
  if (val === null || val === void 0) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(
      val.getMinutes()
    )}:${pad(val.getSeconds())}`;
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}
function quoteIdentifier(name) {
  return `"${name.replace(/"/g, '""')}"`;
}
function buildPageSql(quotedTable, quotedFields, pkField, pkStrategy, lastValue, offset, pageSize) {
  if ((pkStrategy === "cursor" || pkStrategy === "uuid") && pkField) {
    const op = lastValue ? ">" : ">=";
    return {
      sql: `SELECT ${quotedFields} FROM ${quotedTable} WHERE ${quoteIdentifier(pkField)} ${op} $1 ORDER BY ${quoteIdentifier(pkField)} LIMIT ${pageSize}`,
      bind: lastValue ? [lastValue] : [0]
    };
  }
  const orderBy = pkField ? `ORDER BY ${quoteIdentifier(pkField)}` : "";
  return {
    sql: `SELECT ${quotedFields} FROM ${quotedTable} ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`,
    bind: []
  };
}
function resolveExportBaseName(tableName, fileNameTemplate) {
  if (fileNameTemplate) {
    const d = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
      d.getMinutes()
    )}${pad(d.getSeconds())}`;
    return fileNameTemplate.replace(/\{表名\}/g, tableName).replace(/\{日期\}/g, date);
  }
  return `sjgl02_export_${tableName}_${Date.now()}`;
}
function formatDateToken() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(
    d.getSeconds()
  )}`;
}
async function buildExportZip(options) {
  const { xlsxPath, attachments, outputPath, baseName } = options;
  const archiver = require("archiver");
  const output = import_fs.default.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 6 } });
  await new Promise((resolve, reject) => {
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(xlsxPath, { name: `${baseName}.xlsx` });
    const storageDir = process.env.STORAGE_DIR || "storage/uploads";
    for (const att of attachments) {
      if (!att.path) continue;
      const attPath = import_path.default.isAbsolute(att.path) ? att.path : import_path.default.join(storageDir, att.path);
      if (!import_fs.default.existsSync(attPath)) continue;
      archive.file(attPath, { name: `attachments/${att.filename}` });
    }
    archive.finalize();
  });
  return outputPath;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildExportZip,
  buildPageSql,
  formatDateToken,
  formatValue,
  quoteIdentifier,
  resolveExportBaseName
});
