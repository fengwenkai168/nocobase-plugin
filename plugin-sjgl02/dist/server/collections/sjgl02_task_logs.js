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
var sjgl02_task_logs_exports = {};
__export(sjgl02_task_logs_exports, {
  default: () => sjgl02_task_logs_default
});
module.exports = __toCommonJS(sjgl02_task_logs_exports);
var import_database = require("@nocobase/database");
var sjgl02_task_logs_default = (0, import_database.defineCollection)({
  name: "sjgl02_task_logs",
  title: "\u4EFB\u52A1\u6267\u884C\u65E5\u5FD7",
  timestamps: true,
  autoGenId: true,
  indexes: [
    { fields: ["taskId"] },
    { fields: ["timestamp"] }
  ],
  fields: [
    { type: "integer", name: "taskId" },
    {
      interface: "select",
      type: "string",
      name: "level",
      uiSchema: {
        enum: [
          { value: "INFO", label: "\u4FE1\u606F" },
          { value: "SUCC", label: "\u6210\u529F" },
          { value: "WARN", label: "\u8B66\u544A" },
          { value: "ERROR", label: "\u9519\u8BEF" }
        ]
      }
    },
    { type: "text", name: "message" },
    { type: "date", name: "timestamp" },
    { type: "belongsTo", name: "task", target: "sjgl02_tasks", foreignKey: "taskId" }
  ]
});
