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
var add_task_file_name_exports = {};
__export(add_task_file_name_exports, {
  default: () => add_task_file_name_default
});
module.exports = __toCommonJS(add_task_file_name_exports);
var import_server = require("@nocobase/server");
var import_database = require("@nocobase/database");
class add_task_file_name_default extends import_server.Migration {
  on = "beforeLoad";
  async up() {
    const tableExists = await this.db.sequelize.getQueryInterface().showAllTables().then((tables) => tables.includes("sjgl02_tasks"));
    if (!tableExists) return;
    const columns = await this.db.sequelize.getQueryInterface().describeTable("sjgl02_tasks");
    if (!columns.file_name) {
      await this.db.sequelize.getQueryInterface().addColumn("sjgl02_tasks", "file_name", { type: import_database.DataTypes.STRING(255) });
    }
  }
}
