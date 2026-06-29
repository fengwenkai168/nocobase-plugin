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
var sjgl02_settings_exports = {};
__export(sjgl02_settings_exports, {
  default: () => sjgl02_settings_default
});
module.exports = __toCommonJS(sjgl02_settings_exports);
var import_database = require("@nocobase/database");
var sjgl02_settings_default = (0, import_database.defineCollection)({
  name: "sjgl02_settings",
  title: "\u6570\u636E\u7BA1\u7406\u8BBE\u7F6E",
  fields: [
    {
      type: "string",
      name: "taskViewScope",
      defaultValue: "own"
    },
    {
      type: "integer",
      name: "maxFileSize",
      defaultValue: 50
    },
    {
      type: "integer",
      name: "batchSize",
      defaultValue: 1e3
    }
  ]
});
