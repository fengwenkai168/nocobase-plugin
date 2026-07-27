/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var value_converter_exports = {};
__export(value_converter_exports, {
  convertFieldValue: () => convertFieldValue,
  getTargetPkMeta: () => getTargetPkMeta,
  isBlank: () => isBlank,
  isSystemField: () => isSystemField,
  parseDateValue: () => parseDateValue
});
module.exports = __toCommonJS(value_converter_exports);
const SYSTEM_FIELD_NAMES = ["createdAt", "updatedAt", "createdById", "updatedById"];
function isSystemField(name) {
  return SYSTEM_FIELD_NAMES.includes(name);
}
function isBlank(raw) {
  return raw === null || raw === void 0 || typeof raw === "string" && raw.trim() === "";
}
function fail(reason) {
  return { status: "error", error: reason };
}
const ok = (value) => ({ status: "ok", value });
const skip = { status: "skip" };
function getTargetPkMeta(ctx, collectionName) {
  var _a;
  let meta = ctx.pkMetaCache.get(collectionName);
  if (!meta) {
    const collection = ctx.db.getCollection(collectionName);
    if (!collection) {
      throw new Error(`\u5173\u8054\u8868 ${collectionName} \u4E0D\u5B58\u5728`);
    }
    const pkName = collection.options.filterTargetKey || collection.model.primaryKeyAttribute || "id";
    const pkField = collection.getField(pkName);
    meta = { name: pkName, type: ((_a = pkField == null ? void 0 : pkField.options) == null ? void 0 : _a.type) || "bigInt" };
    ctx.pkMetaCache.set(collectionName, meta);
  }
  return meta;
}
function coercePkValue(raw, pkType) {
  if (isBlank(raw)) return null;
  if (["integer", "bigInt", "snowflakeId"].includes(pkType)) {
    const num = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
    return num;
  }
  return String(raw).trim();
}
async function ensureExists(ctx, collectionName, value) {
  const pk = getTargetPkMeta(ctx, collectionName);
  const cacheKey = `${collectionName}:${value}`;
  const cached = ctx.existsCache.get(cacheKey);
  if (cached !== void 0) return cached;
  const repo = ctx.db.getRepository(collectionName);
  const found = await repo.findOne({ filter: { [pk.name]: value }, fields: [pk.name] });
  const exists = !!found;
  ctx.existsCache.set(cacheKey, exists);
  return exists;
}
function parseDateValue(raw) {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw >= 1e12) return new Date(raw);
    if (raw >= 1e9) return new Date(raw * 1e3);
    if (raw > 2e4 && raw < 2e5) return new Date(Math.round((raw - 25569) * 86400 * 1e3));
    return null;
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  if (/^\d{13,}$/.test(text)) return new Date(Number(text));
  if (/^\d{10}$/.test(text)) return new Date(Number(text) * 1e3);
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 2e4 && serial < 2e5) return new Date(Math.round((serial - 25569) * 86400 * 1e3));
    return null;
  }
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (match) {
    const [, y, mo, d, h = "0", mi = "0", s = "0"] = match;
    const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (isNaN(date.getTime())) return null;
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }
  const parsed = Date.parse(text);
  if (!isNaN(parsed)) return new Date(parsed);
  return null;
}
function parseBooleanValue(raw) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim().toLowerCase();
  if (["true", "1", "\u662F", "\u542F\u7528", "yes", "y"].includes(text)) return true;
  if (["false", "0", "\u5426", "\u505C\u7528", "no", "n"].includes(text)) return false;
  return null;
}
function splitMultiValue(raw) {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  return String(raw).split(/[,，]/).map((v) => v.trim()).filter(Boolean);
}
function matchOption(meta, label) {
  const options = meta.options || [];
  const hit = options.find((o) => o.label === label);
  return hit ? hit.value : null;
}
const RELATION_EFFECTIVE_TYPES = ["belongsTo", "hasOne", "hasMany", "belongsToMany"];
function fieldCfg(ctx, name) {
  var _a;
  return ((_a = ctx.fieldConfigs) == null ? void 0 : _a[name]) || {};
}
async function convertFieldValue(meta, raw, ctx) {
  var _a;
  if (meta.ignored) return skip;
  const required = ctx.requiredFields.includes(meta.name);
  const effectiveType = meta.interface === "select" || meta.type === "select" ? "select" : meta.interface === "multipleSelect" ? "multipleSelect" : meta.type;
  const cfg = fieldCfg(ctx, meta.name);
  const notFoundSkip = cfg.notFound === "skip";
  if (isBlank(raw)) {
    if (ctx.mode === "insert") {
      if (required) return fail(`\u5FC5\u586B\u5B57\u6BB5 ${meta.title}(${meta.name}) \u4E3A\u7A7A`);
      return skip;
    }
    if (RELATION_EFFECTIVE_TYPES.includes(effectiveType)) {
      if (cfg.emptyStrategy === "clear") {
        return effectiveType === "hasMany" || effectiveType === "belongsToMany" ? ok([]) : ok(null);
      }
      return skip;
    }
    if (ctx.blankStrategy === "preserve") return skip;
    if (required) return fail(`\u5FC5\u586B\u5B57\u6BB5 ${meta.title}(${meta.name}) \u4E3A\u7A7A`);
    return ok(null);
  }
  switch (effectiveType) {
    case "string":
    case "text":
    case "uid":
      return ok(String(raw));
    case "integer":
    case "bigInt":
    case "sort": {
      const num = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(num) || !Number.isInteger(num)) return fail(`\u6574\u6570\u8F6C\u6362\u5931\u8D25: "${raw}"`);
      return ok(num);
    }
    case "float":
    case "double":
    case "real":
    case "decimal":
    case "percent": {
      const num = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(num)) return fail(`\u6570\u5B57\u8F6C\u6362\u5931\u8D25: "${raw}"`);
      return ok(num);
    }
    case "boolean":
    case "radio": {
      const val = parseBooleanValue(raw);
      if (val === null) return fail(`\u65E0\u6CD5\u8BC6\u522B\u4E3A\u5E03\u5C14\u503C: "${raw}"`);
      return ok(val);
    }
    case "date":
    case "datetimeTz":
    case "datetimeNoTz":
    case "dateOnly":
    case "unixTimestamp": {
      const date = parseDateValue(raw);
      if (!date) return fail(`\u65E5\u671F\u683C\u5F0F\u65E0\u6CD5\u89E3\u6790: "${raw}"`);
      return ok(date);
    }
    case "select": {
      const label = String(raw).trim();
      const value = matchOption(meta, label);
      if (value === null) return fail(`\u9009\u9879\u4E0D\u5B58\u5728: "${label}"`);
      return ok(value);
    }
    case "checkbox":
    case "array":
    case "set":
    case "multipleSelect": {
      const labels = splitMultiValue(raw);
      if ((_a = meta.options) == null ? void 0 : _a.length) {
        const values = [];
        for (const label of labels) {
          const value = matchOption(meta, label);
          if (value === null) return fail(`\u9009\u9879\u4E0D\u5B58\u5728: "${label}"`);
          values.push(value);
        }
        return ok(values);
      }
      return ok(labels);
    }
    case "belongsTo":
    case "hasOne": {
      const pk = getTargetPkMeta(ctx, meta.target);
      const value = coercePkValue(raw, pk.type);
      if (value === null) return fail(`\u4E0E\u76EE\u6807\u8868 ${meta.target} \u4E3B\u952E(${pk.type})\u7C7B\u578B\u4E0D\u5339\u914D: "${raw}"`);
      if (!await ensureExists(ctx, meta.target, value)) {
        if (notFoundSkip) return skip;
        return fail(`\u5173\u8054\u8BB0\u5F55\u4E0D\u5B58\u5728: ${meta.target}.${pk.name}="${raw}"`);
      }
      return ok(value);
    }
    case "hasMany":
    case "belongsToMany": {
      const pk = getTargetPkMeta(ctx, meta.target);
      const parts = splitMultiValue(raw);
      const values = [];
      for (const part of parts) {
        const value = coercePkValue(part, pk.type);
        if (value === null) return fail(`\u4E0E\u76EE\u6807\u8868 ${meta.target} \u4E3B\u952E(${pk.type})\u7C7B\u578B\u4E0D\u5339\u914D: "${part}"`);
        if (!await ensureExists(ctx, meta.target, value)) {
          if (notFoundSkip) return skip;
          return fail(`\u5173\u8054\u8BB0\u5F55\u4E0D\u5B58\u5728: ${meta.target}.${pk.name}="${part}"`);
        }
        values.push(value);
      }
      return ok(values);
    }
    case "json":
    case "jsonb": {
      if (typeof raw === "object") return ok(raw);
      try {
        return ok(JSON.parse(String(raw)));
      } catch {
        return fail(`JSON \u683C\u5F0F\u9519\u8BEF: "${raw}"`);
      }
    }
    case "password":
      return ok(String(raw));
    default:
      return ok(typeof raw === "string" ? raw : raw);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  convertFieldValue,
  getTargetPkMeta,
  isBlank,
  isSystemField,
  parseDateValue
});
