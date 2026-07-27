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
var sjgl02PermissionLogs_exports = {};
__export(sjgl02PermissionLogs_exports, {
  default: () => sjgl02PermissionLogs_default
});
module.exports = __toCommonJS(sjgl02PermissionLogs_exports);
var import_database = require("@nocobase/database");
var sjgl02PermissionLogs_default = (0, import_database.defineCollection)({
  name: "sjgl02PermissionLogs",
  title: "\u6570\u636E\u7BA1\u7406\u6743\u9650\u64CD\u4F5C\u65E5\u5FD7",
  createdBy: true,
  updatedBy: false,
  logging: false,
  indexes: [
    // 自定义索引名：规避 1.0.x 旧版蛇形表残留的同名列索引冲突（框架 addIndex 按字段去重，预声明后不再生成默认蛇形名）
    { name: "idx_sjgl02plogs_created_by", fields: ["createdById"] },
    { name: "idx_sjgl02plogs_action", fields: ["action"] },
    { name: "idx_sjgl02plogs_target_id", fields: ["targetId"] },
    { name: "idx_sjgl02plogs_collection", fields: ["collectionName"] }
  ],
  fields: [
    { type: "string", name: "action", allowNull: false, index: true, comment: "create | update | delete | toggle" },
    { type: "string", name: "targetType", allowNull: false },
    { type: "string", name: "targetId", allowNull: false, index: true },
    { type: "string", name: "targetName" },
    { type: "string", name: "collectionName", index: true },
    { type: "string", name: "collectionTitle" },
    { type: "integer", name: "permissionId" },
    { type: "jsonb", name: "beforeValue", comment: "\u64CD\u4F5C\u524D\u5FEB\u7167" },
    { type: "jsonb", name: "afterValue", comment: "\u64CD\u4F5C\u540E\u5FEB\u7167" },
    { type: "string", name: "summary", comment: "\u53D8\u66F4\u6982\u8981" }
  ]
});
