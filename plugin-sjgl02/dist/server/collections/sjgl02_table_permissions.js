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
      interface: "select",
      type: "string",
      name: "targetType",
      uiSchema: { enum: [{ value: "user", label: "\u7528\u6237" }, { value: "role", label: "\u89D2\u8272" }] }
    },
    { type: "string", name: "targetId" },
    { type: "string", name: "targetName" },
    { type: "string", name: "tableName" },
    { type: "boolean", name: "canImport", defaultValue: false },
    { type: "boolean", name: "canExport", defaultValue: false },
    {
      interface: "select",
      type: "string",
      name: "importMode",
      defaultValue: "insert",
      uiSchema: { enum: [
        { value: "insert", label: "\u65B0\u589E" },
        { value: "update", label: "\u66F4\u65B0" },
        { value: "upsert", label: "\u65B0\u589E+\u66F4\u65B0" }
      ] }
    },
    { type: "json", name: "uniqueFields" },
    { type: "json", name: "requiredFields" },
    { type: "json", name: "importFields" },
    { type: "json", name: "exportFields" },
    { type: "json", name: "exportFilter" }
  ]
});
