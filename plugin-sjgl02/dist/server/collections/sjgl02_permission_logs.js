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
var sjgl02_permission_logs_exports = {};
__export(sjgl02_permission_logs_exports, {
  default: () => sjgl02_permission_logs_default
});
module.exports = __toCommonJS(sjgl02_permission_logs_exports);
var import_database = require("@nocobase/database");
var sjgl02_permission_logs_default = (0, import_database.defineCollection)({
  name: "sjgl02_permission_logs",
  title: "\u6743\u9650\u64CD\u4F5C\u65E5\u5FD7",
  fields: [
    { type: "string", name: "action", interface: "select", uiSchema: { enum: [
      { value: "create", label: "\u521B\u5EFA" },
      { value: "update", label: "\u4FEE\u6539" },
      { value: "delete", label: "\u5220\u9664" },
      { value: "toggle", label: "\u5207\u6362" }
    ] } },
    { type: "string", name: "targetType" },
    { type: "string", name: "targetId" },
    { type: "string", name: "targetName" },
    { type: "string", name: "tableName" },
    { type: "json", name: "changes", description: "\u53D8\u66F4\u5185\u5BB9\u5FEB\u7167" },
    {
      type: "belongsTo",
      name: "operator",
      target: "users",
      foreignKey: "operatorId"
    },
    { type: "date", name: "createdAt" }
  ],
  timestamps: false,
  autoGenId: true,
  indexes: [
    { fields: ["targetType", "targetId"] },
    { fields: ["createdAt"] }
  ]
});
