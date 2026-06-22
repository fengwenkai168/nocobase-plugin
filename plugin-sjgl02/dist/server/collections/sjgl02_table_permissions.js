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
var sjgl02_table_permissions_exports = {};
__export(sjgl02_table_permissions_exports, {
  default: () => sjgl02_table_permissions_default
});
module.exports = __toCommonJS(sjgl02_table_permissions_exports);
var import_database = require("@nocobase/database");
var sjgl02_table_permissions_default = (0, import_database.defineCollection)({
  name: "sjgl02_table_permissions",
  title: "\u8868\u7EA7\u6743\u9650\u914D\u7F6E",
  fields: [
    {
      type: "string",
      name: "targetType"
    },
    {
      type: "integer",
      name: "targetId"
    },
    {
      type: "string",
      name: "targetName"
    },
    {
      type: "string",
      name: "tableName"
    },
    {
      type: "boolean",
      name: "canImport",
      defaultValue: false
    },
    {
      type: "boolean",
      name: "canExport",
      defaultValue: false
    },
    {
      type: "string",
      name: "importMode",
      defaultValue: "insert"
    },
    {
      type: "json",
      name: "uniqueFields"
    },
    {
      type: "json",
      name: "requiredFields"
    },
    {
      type: "json",
      name: "importFields"
    },
    {
      type: "json",
      name: "exportFields"
    },
    {
      type: "json",
      name: "exportFilter"
    }
  ]
});
