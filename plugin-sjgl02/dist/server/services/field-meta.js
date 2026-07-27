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
var field_meta_exports = {};
__export(field_meta_exports, {
  buildFieldMeta: () => buildFieldMeta,
  cleanTitle: () => cleanTitle,
  listExportableFields: () => listExportableFields
});
module.exports = __toCommonJS(field_meta_exports);
const IGNORED_INTERFACES = ["subTable", "subForm"];
const IGNORED_TYPES = ["formula", "sequenceField", "virtual"];
function cleanTitle(title, fallback) {
  const text = String(title || "");
  const match = text.match(/^\{\{t\("(.+?)"\)\}\}$/);
  return match ? match[1] : text || fallback;
}
function buildFieldMeta(db, collectionName, fieldName) {
  const collection = db.getCollection(collectionName);
  const field = collection == null ? void 0 : collection.getField(fieldName);
  if (!collection || !field) return null;
  const options = field.options;
  const uiSchema = options.uiSchema || {};
  const componentProps = uiSchema["x-component-props"] || {};
  const rawOptions = componentProps.options || uiSchema.enum || void 0;
  const type = String(options.type || "string");
  const iface = options.interface || uiSchema["x-component"] || void 0;
  return {
    name: fieldName,
    title: cleanTitle(uiSchema.title, fieldName),
    type,
    interface: iface,
    options: rawOptions == null ? void 0 : rawOptions.map((o) => ({ label: String(o.label), value: String(o.value) })),
    target: options.target,
    targetKey: options.targetKey,
    foreignKey: options.foreignKey,
    through: options.through,
    sourceKey: options.sourceKey,
    otherKey: options.otherKey,
    multiple: type === "hasMany" || type === "belongsToMany",
    ignored: IGNORED_TYPES.includes(type) || (iface ? IGNORED_INTERFACES.includes(iface) : false),
    attachment: iface === "attachment"
  };
}
function listExportableFields(db, collectionName) {
  const collection = db.getCollection(collectionName);
  if (!collection) return [];
  const relationForeignKeys = /* @__PURE__ */ new Set();
  for (const field of collection.fields.values()) {
    const options = field.options;
    if (["belongsTo", "hasOne"].includes(String(options.type)) && options.foreignKey) {
      relationForeignKeys.add(String(options.foreignKey));
    }
  }
  const names = /* @__PURE__ */ new Set([...collection.fields.keys()]);
  for (const attr of Object.keys(collection.model.rawAttributes || {})) {
    if (!relationForeignKeys.has(attr)) names.add(attr);
  }
  const out = [];
  for (const name of names) {
    const meta = buildFieldMeta(db, collectionName, name);
    if (meta && !meta.ignored) out.push(meta);
  }
  return out;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildFieldMeta,
  cleanTitle,
  listExportableFields
});
