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
var import_utils_exports = {};
__export(import_utils_exports, {
  applyBelongsToFK: () => applyBelongsToFK,
  buildSnapshot: () => buildSnapshot,
  convertRecordValues: () => convertRecordValues,
  convertValue: () => convertValue,
  dropShadowNotNull: () => dropShadowNotNull,
  getAllowedFieldNames: () => getAllowedFieldNames,
  getFieldType: () => getFieldType,
  getPrimaryKeyColumns: () => getPrimaryKeyColumns,
  insertBatch: () => insertBatch,
  insertWithSplit: () => insertWithSplit,
  isEmptyRow: () => isEmptyRow,
  makeRecord: () => makeRecord,
  normalizeDateValue: () => normalizeDateValue,
  prepareShadowPrimaryKey: () => prepareShadowPrimaryKey,
  quoteIdentifier: () => quoteIdentifier,
  resolveAttachmentFilePath: () => resolveAttachmentFilePath,
  resolveMappedDataColumns: () => resolveMappedDataColumns,
  validateCollectionName: () => validateCollectionName
});
module.exports = __toCommonJS(import_utils_exports);
function quoteIdentifier(name) {
  const DQ = String.fromCharCode(34);
  const DDQ = DQ + DQ;
  return DQ + name.replace(new RegExp(DQ, "g"), DDQ) + DQ;
}
async function resolveAttachmentFilePath(db, attachment) {
  let documentRoot = process.env.LOCAL_STORAGE_DEST || "";
  if (!documentRoot) {
    try {
      const storageRepo = db.getRepository("storages");
      const storage = await storageRepo.findOne({ filter: { id: attachment.storageId } });
      if (storage) {
        const options = storage.get("options") || {};
        documentRoot = options.documentRoot || "";
      }
    } catch {
    }
  }
  if (!documentRoot) {
    documentRoot = process.env.STORAGE_DIR || "storage/uploads";
  }
  const { default: path } = await import("path");
  return path.join(documentRoot, attachment.path || attachment.filename);
}
async function getPrimaryKeyColumns(sequelize, tableName) {
  try {
    const [rows] = await sequelize.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_name = :tableName
         AND tc.table_schema = current_schema()
       ORDER BY kcu.ordinal_position`,
      { replacements: { tableName }, raw: true }
    );
    return rows.map((r) => r.column_name);
  } catch {
    return [];
  }
}
async function prepareShadowPrimaryKey(sequelize, shadowTableName, pkColumns, transaction) {
  for (const pk of pkColumns) {
    await sequelize.query(
      "ALTER TABLE " + quoteIdentifier(shadowTableName) + " ALTER COLUMN " + quoteIdentifier(pk) + " DROP NOT NULL",
      { transaction }
    );
  }
}
async function dropShadowNotNull(sequelize, shadowTableName, columns, transaction) {
  for (const col of columns) {
    await sequelize.query(
      "ALTER TABLE " + quoteIdentifier(shadowTableName) + " ALTER COLUMN " + quoteIdentifier(col) + " DROP NOT NULL",
      { transaction }
    );
  }
}
function resolveMappedDataColumns(allColumns, mapping, coll, pkColumns) {
  var _a, _b;
  const autoSystemFields = /* @__PURE__ */ new Set(["createdAt", "updatedAt", "createdById", "updatedById"]);
  const mappedFieldSet = /* @__PURE__ */ new Set();
  for (const [fieldName, excelCol] of Object.entries(mapping)) {
    if (!excelCol || excelCol === "__ignore__") continue;
    let resolved = fieldName;
    try {
      for (const f of Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || [])) {
        if (f.name === fieldName && f.type === "belongsTo" && ((_b = f.options) == null ? void 0 : _b.foreignKey)) {
          resolved = f.options.foreignKey;
          break;
        }
      }
    } catch {
    }
    mappedFieldSet.add(resolved);
  }
  return allColumns.filter((c) => mappedFieldSet.has(c));
}
function validateCollectionName(db, name) {
  const coll = db.getCollection(name);
  if (!coll) throw new Error("\u6570\u636E\u8868 " + name + " \u4E0D\u5B58\u5728");
  return coll;
}
function getAllowedFieldNames(coll) {
  var _a;
  const set = /* @__PURE__ */ new Set();
  try {
    for (const f of Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || [])) {
      set.add(f.name);
    }
  } catch {
  }
  return set;
}
function getFieldType(coll, name) {
  try {
    const f = coll.fields instanceof Map ? coll.fields.get(name) : null;
    return (f == null ? void 0 : f.type) || "string";
  } catch {
    return "string";
  }
}
function normalizeDateValue(val) {
  if (val === null || val === void 0 || val === "") return null;
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return val.getFullYear() + "-" + pad(val.getMonth() + 1) + "-" + pad(val.getDate()) + " " + pad(val.getHours()) + ":" + pad(val.getMinutes()) + ":" + pad(val.getSeconds());
  }
  if (typeof val === "number") {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + val * 864e5);
    if (!isNaN(d.getTime())) return normalizeDateValue(d);
  }
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return normalizeDateValue(d);
  }
  return null;
}
function convertValue(raw, fieldType) {
  if (raw === null || raw === void 0) return null;
  if (fieldType === "integer" || fieldType === "bigInt" || fieldType === "float" || fieldType === "double" || fieldType === "decimal" || fieldType === "number") {
    if (typeof raw === "number") return raw;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  if (fieldType === "boolean") {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      if (["true", "1", "yes", "\u662F"].includes(s)) return true;
      if (["false", "0", "no", "\u5426"].includes(s)) return false;
    }
    return null;
  }
  if (fieldType === "json" || fieldType === "array") {
    if (typeof raw === "object") return raw;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return fieldType === "array" ? raw.split(",").map((s) => s.trim()) : raw;
      }
    }
    return raw;
  }
  if (["date", "datetime", "datetimeTz", "unixTimestamp"].includes(fieldType)) {
    return normalizeDateValue(raw);
  }
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}
function convertRecordValues(record, coll) {
  const result = {};
  for (const [key, val] of Object.entries(record)) {
    if (val === void 0) continue;
    if (val === "") {
      const ft = getFieldType(coll, key);
      if (ft !== "string" && ft !== "text" && ft !== "password") {
        result[key] = null;
        continue;
      }
    }
    result[key] = convertValue(val, getFieldType(coll, key));
  }
  return result;
}
function applyBelongsToFK(record, headers, vals, mapping, coll) {
  var _a, _b;
  const belongs = [];
  try {
    belongs.push(...Array.from(((_a = coll.fields) == null ? void 0 : _a.values()) || coll.fields || []).filter((f) => f.type === "belongsTo"));
  } catch {
  }
  for (const bf of belongs) {
    const fk = ((_b = bf.options) == null ? void 0 : _b.foreignKey) || bf.name + "Id";
    const mappedVal = mapping[bf.name];
    if (mappedVal && mappedVal !== "__ignore__" && mappedVal !== "__custom__") {
      const colIdx = headers.indexOf(mappedVal);
      if (colIdx >= 0 && colIdx < vals.length) {
        record[fk] = vals[colIdx];
      }
      delete record[bf.name];
    }
  }
}
function makeRecord(vals, headers, mapping, customValues) {
  const record = {};
  for (const [tableField, excelCol] of Object.entries(mapping)) {
    if (!excelCol || excelCol === "__ignore__") continue;
    if (excelCol === "__custom__") {
      record[tableField] = customValues[tableField] ?? "";
      continue;
    }
    const colIndex = headers.indexOf(excelCol);
    if (colIndex >= 0 && colIndex < vals.length) {
      const raw = vals[colIndex];
      if (raw === void 0 || raw === null || raw === "") {
        record[tableField] = "";
        continue;
      }
      record[tableField] = raw;
    } else {
      record[tableField] = "";
    }
  }
  return record;
}
function buildSnapshot(vals, headers, mapping, customValues) {
  const snap = {};
  Object.entries(mapping).forEach(([fieldName, excelCol]) => {
    if (excelCol && excelCol !== "__ignore__") {
      if (excelCol === "__custom__") {
        snap[fieldName + "=(\u81EA\u5B9A\u4E49)"] = customValues[fieldName] || "";
      } else {
        const idx = headers.indexOf(excelCol);
        if (idx >= 0 && idx < vals.length) snap[excelCol + "\u2192" + fieldName] = String(vals[idx] ?? "");
      }
    }
  });
  return JSON.stringify(snap).substring(0, 500);
}
function isEmptyRow(vals, headers, mapping) {
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
async function insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, batch, transaction) {
  const placeholders = batch.map((_, ri) => "(" + dataColumns.map((__, ci) => "$" + (ri * dataColumns.length + ci + 1)).join(", ") + ")").join(", ");
  const flatValues = batch.flat();
  await sequelize.query("INSERT INTO " + quotedShadow + " (" + quotedCols + ") VALUES " + placeholders, {
    bind: flatValues,
    transaction
  });
}
async function insertWithSplit(sequelize, quotedShadow, quotedCols, dataColumns, batch, startOffset, transaction) {
  const errLogs = [];
  const SUB_SIZE = Math.max(1, Math.floor(batch.length / 10));
  if (SUB_SIZE === 1) {
    for (let si = 0; si < batch.length; si++) {
      try {
        await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, [batch[si]], transaction);
      } catch (e) {
        errLogs.push({
          row: startOffset + si + 1,
          excelRow: 0,
          reason: e.message || String(e),
          snapshot: JSON.stringify(
            dataColumns.reduce((acc, c, i) => {
              acc[c] = batch[si][i];
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
        await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, sub, transaction);
      } catch {
        const subLogs = await insertWithSplit(
          sequelize,
          quotedShadow,
          quotedCols,
          dataColumns,
          sub,
          startOffset + si,
          transaction
        );
        errLogs.push(...subLogs);
        if (errLogs.length > 100) break;
      }
    }
  }
  return errLogs;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyBelongsToFK,
  buildSnapshot,
  convertRecordValues,
  convertValue,
  dropShadowNotNull,
  getAllowedFieldNames,
  getFieldType,
  getPrimaryKeyColumns,
  insertBatch,
  insertWithSplit,
  isEmptyRow,
  makeRecord,
  normalizeDateValue,
  prepareShadowPrimaryKey,
  quoteIdentifier,
  resolveAttachmentFilePath,
  resolveMappedDataColumns,
  validateCollectionName
});
