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
var worker_utils_exports = {};
__export(worker_utils_exports, {
  detectPkStrategy: () => detectPkStrategy,
  getAssociationSheetConfigs: () => getAssociationSheetConfigs,
  getAttachFieldNames: () => getAttachFieldNames,
  getCollDisplayName: () => getCollDisplayName,
  getFieldDisplayName: () => getFieldDisplayName,
  getFieldMeta: () => getFieldMeta,
  getFieldMetas: () => getFieldMetas,
  getFileIdFieldNames: () => getFileIdFieldNames,
  getRelationFieldNames: () => getRelationFieldNames,
  getScalarFieldNames: () => getScalarFieldNames,
  resolveTempDir: () => resolveTempDir,
  sanitizeSheetName: () => sanitizeSheetName
});
module.exports = __toCommonJS(worker_utils_exports);
var import_path = __toESM(require("path"));
function resolveTempDir() {
  const storageDir = process.env.STORAGE_DIR || "storage/uploads";
  return import_path.default.join(storageDir, "exports");
}
function sanitizeSheetName(name) {
  return name.replace(/[\\/:*?[\]:!@#$%^&()]/g, "_").substring(0, 31);
}
function getScalarFieldNames(coll) {
  var _a, _b;
  if (!coll) return [];
  const names = [];
  try {
    for (const f of Array.from(((_b = (_a = coll.fields) == null ? void 0 : _a.values) == null ? void 0 : _b.call(_a)) || coll.fields || [])) {
      const type = f.type;
      if (!["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(type)) {
        names.push(f.name);
      }
    }
  } catch {
  }
  return names;
}
function getRelationFieldNames(coll, types) {
  var _a, _b;
  if (!coll) return [];
  const names = [];
  try {
    for (const f of Array.from(((_b = (_a = coll.fields) == null ? void 0 : _a.values) == null ? void 0 : _b.call(_a)) || coll.fields || [])) {
      if (types.includes(f.type)) {
        names.push(f.name);
      }
    }
  } catch {
  }
  return names;
}
function getFieldDisplayName(coll, fieldName, style) {
  var _a, _b;
  try {
    const f = coll.fields instanceof Map ? coll.fields.get(fieldName) : null;
    const title = (_b = (_a = f == null ? void 0 : f.options) == null ? void 0 : _a.uiSchema) == null ? void 0 : _b.title;
    if (title && !/^\{\{/.test(title)) {
      if (style === "id") return fieldName;
      if (style === "title") return title;
      return `${title}(${fieldName})`;
    }
  } catch {
  }
  return fieldName;
}
function getCollDisplayName(coll, style) {
  var _a;
  const rawName = (coll == null ? void 0 : coll.name) || "";
  let title = ((_a = coll == null ? void 0 : coll.options) == null ? void 0 : _a.title) || rawName;
  if (/^\{\{/.test(title)) title = rawName;
  if (style === "id") return rawName;
  if (style === "title") return title;
  return title !== rawName ? `${title}(${rawName})` : rawName;
}
function detectPkStrategy(coll) {
  var _a, _b, _c, _d, _e, _f, _g;
  try {
    const pkAttrs = ((_a = coll.model) == null ? void 0 : _a.primaryKeyAttributes) || [];
    if (pkAttrs.length === 1) {
      const name = pkAttrs[0];
      const field = ((_c = (_b = coll.fields) == null ? void 0 : _b.get) == null ? void 0 : _c.call(_b, name)) || ((_d = coll.fields) == null ? void 0 : _d[name]);
      const type = String((field == null ? void 0 : field.type) || "other").toLowerCase();
      if (type.includes("uuid")) return { strategy: "uuid", pkField: name };
      if ((type.includes("int") || type === "bigint") && ((_g = (_f = (_e = coll.model) == null ? void 0 : _e.rawAttributes) == null ? void 0 : _f[name]) == null ? void 0 : _g.autoIncrement)) {
        return { strategy: "cursor", pkField: name };
      }
      return { strategy: "offset", pkField: name };
    }
  } catch {
  }
  return { strategy: "offset", pkField: null };
}
function getAttachFieldNames(coll) {
  var _a, _b, _c;
  if (!coll) return [];
  const names = [];
  try {
    for (const f of Array.from(((_b = (_a = coll.fields) == null ? void 0 : _a.values) == null ? void 0 : _b.call(_a)) || coll.fields || [])) {
      if (f.type === "belongsToMany" && ((_c = f.options) == null ? void 0 : _c.interface) === "attachment") {
        names.push(f.name);
      }
    }
  } catch {
  }
  return names;
}
function getFileIdFieldNames(coll) {
  var _a, _b;
  if (!coll) return [];
  const names = [];
  try {
    for (const f of Array.from(((_b = (_a = coll.fields) == null ? void 0 : _a.values) == null ? void 0 : _b.call(_a)) || coll.fields || [])) {
      if (f.type === "integer" && /FileId$/.test(f.name)) {
        names.push(f.name);
      }
    }
  } catch {
  }
  return names;
}
function isAttachmentField(f) {
  var _a;
  if (f.type === "belongsToMany" && ((_a = f.options) == null ? void 0 : _a.interface) === "attachment") return true;
  if (f.type === "integer" && /FileId$/.test(f.name)) return true;
  return false;
}
function getFieldMetas(coll, selectedFields) {
  var _a, _b, _c, _d, _e, _f, _g;
  if (!coll) return [];
  const metas = [];
  try {
    const fields = Array.from(((_b = (_a = coll.fields) == null ? void 0 : _a.values) == null ? void 0 : _b.call(_a)) || coll.fields || []);
    for (const f of fields) {
      const name = f.name;
      if (selectedFields && selectedFields.length > 0 && !selectedFields.includes(name)) continue;
      const type = String(f.type || "string");
      const isRelation = ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(type);
      const isAttachment = isAttachmentField(f);
      const isScalar = !isRelation && !isAttachment;
      const meta = {
        name,
        type,
        isScalar,
        isRelation,
        isAttachment,
        interface: ((_c = f.options) == null ? void 0 : _c.interface) || null
      };
      if (isRelation || isAttachment) {
        meta.target = (_d = f.options) == null ? void 0 : _d.target;
        meta.foreignKey = (_e = f.options) == null ? void 0 : _e.foreignKey;
        meta.otherKey = (_f = f.options) == null ? void 0 : _f.otherKey;
        meta.through = (_g = f.options) == null ? void 0 : _g.through;
      }
      metas.push(meta);
    }
  } catch {
  }
  return metas;
}
function getFieldMeta(coll, fieldName) {
  const metas = getFieldMetas(coll);
  return metas.find((m) => m.name === fieldName) || null;
}
function getAssociationSheetConfigs(db, coll, selectedFields, associationSheetTables, headerStyle) {
  var _a;
  const configs = [];
  if (!coll || !associationSheetTables || associationSheetTables.length === 0) return configs;
  try {
    const relationFields = getFieldMetas(coll).filter(
      (m) => m.isRelation && selectedFields.includes(m.name) && associationSheetTables.includes(m.name)
    );
    for (const meta of relationFields) {
      if (!meta.target) continue;
      const targetColl = (_a = db.getCollection) == null ? void 0 : _a.call(db, meta.target);
      if (!targetColl) continue;
      const targetFields = getScalarFieldNames(targetColl);
      if (!targetFields.length) continue;
      const targetFieldHeaders = {};
      for (const f of targetFields) {
        targetFieldHeaders[f] = getFieldDisplayName(targetColl, f, headerStyle);
      }
      configs.push({
        fieldName: meta.name,
        targetTable: meta.target,
        displayName: getCollDisplayName(targetColl, headerStyle),
        targetFields,
        targetFieldHeaders
      });
    }
  } catch {
  }
  return configs;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  detectPkStrategy,
  getAssociationSheetConfigs,
  getAttachFieldNames,
  getCollDisplayName,
  getFieldDisplayName,
  getFieldMeta,
  getFieldMetas,
  getFileIdFieldNames,
  getRelationFieldNames,
  getScalarFieldNames,
  resolveTempDir,
  sanitizeSheetName
});
