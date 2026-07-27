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
var export_format_exports = {};
__export(export_format_exports, {
  DATE_FORMATS: () => DATE_FORMATS,
  formatBooleanValue: () => formatBooleanValue,
  formatDateValue: () => formatDateValue,
  formatMultiSelectValue: () => formatMultiSelectValue,
  formatRelationRecord: () => formatRelationRecord,
  formatSelectValue: () => formatSelectValue,
  getTitleField: () => getTitleField
});
module.exports = __toCommonJS(export_format_exports);
const DATE_FORMATS = [
  "YYYY-MM-DD HH:mm:ss",
  "YYYY/MM/DD HH:mm:ss",
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "DD/MM/YYYY",
  "UTC ISO 8601",
  "\u65F6\u95F4\u6233(\u6BEB\u79D2)",
  "\u65F6\u95F4\u6233(\u79D2)"
];
function pad(num) {
  return String(num).padStart(2, "0");
}
function formatDateValue(value, format) {
  if (value === null || value === void 0 || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return String(value);
  switch (format) {
    case "YYYY-MM-DD HH:mm:ss":
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    case "YYYY/MM/DD HH:mm:ss":
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    case "YYYY-MM-DD":
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    case "YYYY/MM/DD":
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
    case "DD/MM/YYYY":
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    case "UTC ISO 8601":
      return date.toISOString();
    case "\u65F6\u95F4\u6233(\u6BEB\u79D2)":
      return date.getTime();
    case "\u65F6\u95F4\u6233(\u79D2)":
      return Math.floor(date.getTime() / 1e3);
    default:
      return date.toISOString();
  }
}
function formatBooleanValue(value) {
  if (value === null || value === void 0) return null;
  return value ? "\u662F" : "\u5426";
}
function formatSelectValue(value, options) {
  if (value === null || value === void 0 || value === "") return null;
  if (!(options == null ? void 0 : options.length)) return String(value);
  const hit = options.find((o) => o.value === String(value));
  return hit ? hit.label : String(value);
}
function formatMultiSelectValue(value, options) {
  if (value === null || value === void 0 || value === "") return null;
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => formatSelectValue(v, options) ?? String(v)).join(",");
}
function formatRelationRecord(record, pkName, titleField, format) {
  if (!record) return null;
  const pk = record[pkName];
  let display = record[titleField] ?? pk;
  if (typeof display === "string") {
    const match = display.match(/^\{\{t\("(.+?)"\)\}\}$/);
    if (match) display = match[1];
  }
  switch (format) {
    case "pk":
      return pk === null || pk === void 0 ? null : String(pk);
    case "displayPk":
      return `${display}(${pk})`;
    case "display":
    default:
      return display === null || display === void 0 ? null : String(display);
  }
}
function getTitleField(collection, pkName) {
  const configured = collection.options.titleField;
  if (configured && collection.getField(configured)) return configured;
  for (const candidate of ["title", "name", "nickname", "label"]) {
    if (collection.getField(candidate)) return candidate;
  }
  return pkName;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DATE_FORMATS,
  formatBooleanValue,
  formatDateValue,
  formatMultiSelectValue,
  formatRelationRecord,
  formatSelectValue,
  getTitleField
});
