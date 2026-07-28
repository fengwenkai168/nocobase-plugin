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
var sjgl02Tasks_exports = {};
__export(sjgl02Tasks_exports, {
  default: () => sjgl02Tasks_default
});
module.exports = __toCommonJS(sjgl02Tasks_exports);
var import_database = require("@nocobase/database");
var sjgl02Tasks_default = (0, import_database.defineCollection)({
  name: "sjgl02Tasks",
  title: "\u6570\u636E\u7BA1\u7406\u4EFB\u52A1",
  createdBy: true,
  updatedBy: false,
  logging: true,
  indexes: [
    // 自定义索引名：规避 1.0.x 旧版蛇形表残留的同名列索引冲突（框架 addIndex 按字段去重，预声明后不再生成默认蛇形名）
    { name: "idx_sjgl02tasks_created_by", fields: ["createdById"] },
    { name: "idx_sjgl02tasks_status", fields: ["status"] },
    { name: "idx_sjgl02tasks_collection", fields: ["collectionName"] }
  ],
  fields: [
    { type: "string", name: "type", allowNull: false, comment: "import | export | demo" },
    { type: "string", name: "status", allowNull: false, defaultValue: "pending", index: true, comment: "pending | running | succeeded | failed | canceled" },
    { type: "string", name: "title" },
    { type: "string", name: "collectionName", index: true },
    { type: "string", name: "collectionTitle" },
    { type: "jsonb", name: "params", comment: "\u4EFB\u52A1\u914D\u7F6E\u5168\u91CF\u5FEB\u7167" },
    { type: "jsonb", name: "result", comment: "\u5B8C\u6210\u65F6\u7ED3\u679C\u5FEB\u7167\uFF08\u542B\u9519\u8BEF\u660E\u7EC6\u524D100\u6761\u3001\u9884\u89C8\u884C\u524D10\u884C\uFF09" },
    { type: "integer", name: "progressTotal", defaultValue: 0 },
    { type: "integer", name: "progressCurrent", defaultValue: 0 },
    { type: "integer", name: "totalRows", defaultValue: 0 },
    { type: "integer", name: "successRows", defaultValue: 0 },
    { type: "integer", name: "errorRows", defaultValue: 0 },
    { type: "string", name: "filePath" },
    { type: "string", name: "fileName" },
    { type: "bigInt", name: "fileSize" },
    { type: "string", name: "errorReportPath" },
    { type: "integer", name: "permissionConfigId" },
    { type: "string", name: "permissionType" },
    { type: "string", name: "permissionLabel" },
    { type: "text", name: "message" },
    { type: "date", name: "startedAt" },
    { type: "date", name: "doneAt" },
    { type: "integer", name: "duration", comment: "\u8017\u65F6\uFF08\u79D2\uFF09" }
  ]
});
