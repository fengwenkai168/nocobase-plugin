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
var meta_exports = {};
__export(meta_exports, {
  registerMetaActions: () => registerMetaActions
});
module.exports = __toCommonJS(meta_exports);
var import_field_meta = require("../services/field-meta");
function registerMetaActions(plugin) {
  return {
    "collectionMeta": async (ctx, next) => {
      var _a;
      const params = { ...ctx.action.params || {}, ...ctx.action.params.values || {} };
      const { collectionName } = params;
      if (!collectionName) {
        ctx.throw(400, "\u7F3A\u5C11\u53C2\u6570 collectionName");
      }
      const collection = plugin.db.getCollection(String(collectionName));
      if (!collection) {
        ctx.throw(404, `\u6570\u636E\u8868 ${collectionName} \u4E0D\u5B58\u5728`);
      }
      const pkName = collection.options.filterTargetKey || collection.model.primaryKeyAttribute || "id";
      const pkField = collection.getField(pkName);
      const pkType = String(((_a = pkField == null ? void 0 : pkField.options) == null ? void 0 : _a.type) || "bigInt");
      const pkAuto = ["integer", "bigInt"].includes(pkType) || ["uuid", "nanoid", "snowflakeId", "uid"].includes(pkType);
      const fields = (0, import_field_meta.listExportableFields)(plugin.db, String(collectionName)).map((meta) => ({
        name: meta.name,
        title: meta.title,
        type: meta.type,
        interface: meta.interface,
        options: meta.options,
        target: meta.target,
        multiple: meta.multiple,
        attachment: meta.attachment,
        ignored: meta.ignored
      }));
      ctx.body = {
        collectionName: collection.name,
        collectionTitle: (0, import_field_meta.cleanTitle)(collection.options.title, collection.name),
        pk: { name: pkName, type: pkType, auto: pkAuto },
        fields
      };
      await next();
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerMetaActions
});
