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
var sjgl02UserSettings_exports = {};
__export(sjgl02UserSettings_exports, {
  default: () => sjgl02UserSettings_default
});
module.exports = __toCommonJS(sjgl02UserSettings_exports);
var import_database = require("@nocobase/database");
var sjgl02UserSettings_default = (0, import_database.defineCollection)({
  name: "sjgl02UserSettings",
  title: "\u6570\u636E\u7BA1\u7406\u7528\u6237\u8BBE\u7F6E",
  createdBy: false,
  updatedBy: false,
  logging: false,
  fields: [
    { type: "bigInt", name: "userId", allowNull: false, unique: true, index: true },
    { type: "string", name: "taskScope", defaultValue: "self", comment: "self=\u4EC5\u67E5\u770B\u81EA\u5DF1\u7684 | all=\u67E5\u770B\u5168\u90E8" }
  ]
});
