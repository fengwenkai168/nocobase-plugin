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
var remove_export_filter_exports = {};
__export(remove_export_filter_exports, {
  default: () => remove_export_filter_default
});
module.exports = __toCommonJS(remove_export_filter_exports);
var import_server = require("@nocobase/server");
class remove_export_filter_default extends import_server.Migration {
  on = "beforeLoad";
  async up() {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    if (tables.includes("sjgl02_table_permissions")) {
      const columns = await queryInterface.describeTable("sjgl02_table_permissions");
      if (columns.exportFilter) {
        await queryInterface.removeColumn("sjgl02_table_permissions", "exportFilter");
      }
    }
    if (tables.includes("sjgl02_tasks")) {
      const columns = await queryInterface.describeTable("sjgl02_tasks");
      if (columns.exportFilter) {
        await queryInterface.removeColumn("sjgl02_tasks", "exportFilter");
      }
    }
  }
  async down() {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    if (tables.includes("sjgl02_table_permissions")) {
      const columns = await queryInterface.describeTable("sjgl02_table_permissions");
      if (!columns.exportFilter) {
        await queryInterface.addColumn("sjgl02_table_permissions", "exportFilter", { type: "JSONB" });
      }
    }
    if (tables.includes("sjgl02_tasks")) {
      const columns = await queryInterface.describeTable("sjgl02_tasks");
      if (!columns.exportFilter) {
        await queryInterface.addColumn("sjgl02_tasks", "exportFilter", { type: "JSONB" });
      }
    }
  }
}
