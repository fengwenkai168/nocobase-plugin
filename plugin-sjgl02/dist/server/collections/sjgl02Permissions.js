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
var sjgl02Permissions_exports = {};
__export(sjgl02Permissions_exports, {
  default: () => sjgl02Permissions_default
});
module.exports = __toCommonJS(sjgl02Permissions_exports);
var import_database = require("@nocobase/database");
var sjgl02Permissions_default = (0, import_database.defineCollection)({
  name: "sjgl02Permissions",
  title: "\u6570\u636E\u7BA1\u7406\u6743\u9650\u914D\u7F6E",
  createdBy: true,
  updatedBy: true,
  logging: false,
  indexes: [
    { unique: true, fields: ["targetType", "targetId", "collectionName"] },
    // 自定义索引名：规避 1.0.x 旧版蛇形表残留的同名列索引冲突（框架 addIndex 按字段去重，预声明后不再生成默认蛇形名）
    { name: "idx_sjgl02perms_created_by", fields: ["createdById"] },
    { name: "idx_sjgl02perms_updated_by", fields: ["updatedById"] },
    { name: "idx_sjgl02perms_collection", fields: ["collectionName"] }
  ],
  fields: [
    { type: "string", name: "targetType", allowNull: false, comment: "user | role" },
    { type: "string", name: "targetId", allowNull: false, comment: "\u591A\u6001\u5916\u952E\uFF1AuserId \u6216 roleName\uFF08\u5B57\u7B26\u4E32\u5F62\u5F0F\uFF09" },
    { type: "string", name: "targetName", comment: "\u663E\u793A\u540D\u5197\u4F59\uFF08\u89D2\u8272\u53D6 roles.title\uFF09" },
    { type: "string", name: "collectionName", allowNull: false, index: true },
    { type: "string", name: "collectionTitle" },
    { type: "boolean", name: "canImport", defaultValue: false },
    { type: "boolean", name: "canExport", defaultValue: false },
    { type: "jsonb", name: "importModes", comment: '\u5141\u8BB8\u7684\u5BFC\u5165\u6A21\u5F0F\u6570\u7EC4\uFF0C\u5982 ["insert","upsert"]' },
    { type: "jsonb", name: "uniqueFields", comment: "\u552F\u4E00\u503C\u5B57\u6BB5\uFF08\u914D\u7F6E\u5373\u9501\u5B9A\uFF1B\u7A7A=\u5BFC\u5165\u65F6\u81EA\u7531\u9009\u62E9\uFF09" },
    { type: "jsonb", name: "requiredFields", comment: "\u5FC5\u586B\u5B57\u6BB5" },
    { type: "jsonb", name: "importFields", comment: "\u53EF\u5BFC\u5165\u5B57\u6BB5\u767D\u540D\u5355\uFF08\u7A7A=\u5168\u90E8\u5141\u8BB8\uFF09" },
    { type: "jsonb", name: "exportFields", comment: "\u53EF\u5BFC\u51FA\u5B57\u6BB5\u767D\u540D\u5355\uFF08\u7A7A=\u5168\u90E8\u5141\u8BB8\uFF09" },
    { type: "jsonb", name: "exportFilter", comment: "\u5BFC\u51FA\u8303\u56F4\u7B5B\u9009\u6761\u4EF6\uFF08\u540E\u7AEF\u5F3A\u5236\u6267\u884C\uFF09" },
    { type: "integer", name: "sort", defaultValue: 0 }
  ]
});
