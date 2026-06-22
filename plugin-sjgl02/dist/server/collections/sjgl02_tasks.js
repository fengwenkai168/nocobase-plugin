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
var sjgl02_tasks_exports = {};
__export(sjgl02_tasks_exports, {
  default: () => sjgl02_tasks_default
});
module.exports = __toCommonJS(sjgl02_tasks_exports);
var import_database = require("@nocobase/database");
var sjgl02_tasks_default = (0, import_database.defineCollection)({
  name: "sjgl02_tasks",
  title: "\u5BFC\u5165\u5BFC\u51FA\u4EFB\u52A1",
  fields: [
    {
      type: "string",
      name: "taskType",
      defaultValue: "import"
    },
    {
      type: "string",
      name: "tableName"
    },
    {
      type: "string",
      name: "status",
      defaultValue: "pending"
    },
    {
      type: "json",
      name: "fieldMapping"
    },
    {
      type: "json",
      name: "selectedFields"
    },
    {
      type: "json",
      name: "exportFilter"
    },
    {
      type: "json",
      name: "errorLogs"
    },
    {
      type: "integer",
      name: "progress",
      defaultValue: 0
    },
    {
      type: "integer",
      name: "totalRows",
      defaultValue: 0
    },
    {
      type: "integer",
      name: "processedRows",
      defaultValue: 0
    },
    {
      type: "string",
      name: "importMode",
      defaultValue: "insert"
    },
    {
      type: "string",
      name: "sheetName"
    },
    {
      type: "integer",
      name: "headerRow",
      defaultValue: 1
    },
    {
      type: "integer",
      name: "importFileId"
    },
    {
      type: "integer",
      name: "exportFileId"
    },
    {
      type: "text",
      name: "errorMessage"
    },
    {
      type: "boolean",
      name: "includeAssociationSheet",
      defaultValue: false
    },
    {
      type: "json",
      name: "associationSheetTables"
    },
    {
      type: "json",
      name: "associationDisplayMode"
    },
    {
      type: "date",
      name: "completedAt"
    },
    {
      type: "belongsTo",
      name: "createdBy",
      target: "users",
      foreignKey: "createdById"
    }
  ]
});
