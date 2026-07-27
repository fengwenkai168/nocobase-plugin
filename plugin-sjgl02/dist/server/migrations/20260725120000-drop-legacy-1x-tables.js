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
var drop_legacy_1x_tables_exports = {};
__export(drop_legacy_1x_tables_exports, {
  default: () => drop_legacy_1x_tables_default
});
module.exports = __toCommonJS(drop_legacy_1x_tables_exports);
var import_server = require("@nocobase/server");
const LEGACY_TABLES = [
  "sjgl02_permissions",
  "sjgl02_permission_logs",
  "sjgl02_settings",
  "sjgl02_task_files",
  "sjgl02_task_logs",
  "sjgl02_tasks"
];
const REPLACED_INDEXES = [
  "sjgl02_permissions_created_by_id",
  "sjgl02_permissions_updated_by_id",
  "sjgl02_permissions_collection_name",
  "sjgl02_permission_logs_created_by_id",
  "sjgl02_permission_logs_action",
  "sjgl02_permission_logs_target_id",
  "sjgl02_permission_logs_collection_name",
  "sjgl02_tasks_created_by_id",
  "sjgl02_tasks_status",
  "sjgl02_tasks_collection_name"
];
class drop_legacy_1x_tables_default extends import_server.Migration {
  on = "afterSync";
  async up() {
    const tables = await this.queryInterface.showAllTables();
    const existing = LEGACY_TABLES.filter((t) => tables.includes(t));
    if (existing.length) {
      this.app.log.info(`[sjgl02] \u68C0\u6D4B\u5230 1.0.x \u65E7\u7248\u6B8B\u7559\u8868\uFF0C\u5F3A\u5236\u5220\u9664\uFF08\u4E0D\u8FC1\u79FB\u6570\u636E\uFF09: ${existing.join(", ")}`);
      for (const table of existing) {
        await this.sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        this.app.log.info(`[sjgl02] \u5DF2\u5220\u9664\u65E7\u8868 ${table}`);
      }
    }
    for (const index of REPLACED_INDEXES) {
      await this.sequelize.query(`DROP INDEX IF EXISTS "${index}"`);
    }
  }
}
