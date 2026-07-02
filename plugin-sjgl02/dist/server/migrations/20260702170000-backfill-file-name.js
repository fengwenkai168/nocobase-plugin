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
var backfill_file_name_exports = {};
__export(backfill_file_name_exports, {
  default: () => backfill_file_name_default
});
module.exports = __toCommonJS(backfill_file_name_exports);
var import_server = require("@nocobase/server");
class backfill_file_name_default extends import_server.Migration {
  on = "afterSync";
  async up() {
    const { db } = this.context;
    const qi = db.sequelize.getQueryInterface();
    try {
      await qi.sequelize.query(`
        UPDATE sjgl02_tasks
        SET file_name = (
          SELECT filename
          FROM attachments
          WHERE attachments.id = sjgl02_tasks."importFileId"
          LIMIT 1
        )
        WHERE file_name IS NULL AND "importFileId" IS NOT NULL
      `);
    } catch {
    }
    try {
      await qi.sequelize.query(`
        UPDATE sjgl02_tasks
        SET file_name = (
          SELECT filename
          FROM attachments
          WHERE attachments.id = sjgl02_tasks."exportFileId"
          LIMIT 1
        )
        WHERE (file_name IS NULL OR file_name = '')
        AND "exportFileId" IS NOT NULL
      `);
    } catch {
    }
  }
}
