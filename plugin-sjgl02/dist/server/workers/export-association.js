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
var export_association_exports = {};
__export(export_association_exports, {
  exportAssociationSheets: () => exportAssociationSheets
});
module.exports = __toCommonJS(export_association_exports);
var import_export_worker_utils = require("./export-worker-utils");
const PAGE_SIZE = 2e3;
async function exportAssociationSheets(options) {
  const { sequelize, workbook, associationSheets, send } = options;
  if (!associationSheets || associationSheets.length === 0) return;
  for (const cfg of associationSheets) {
    if (await options.isCancelled()) return;
    const sheetName = cfg.displayName.substring(0, 31).replace(/[\\/:*?[\]]/g, "_");
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = cfg.targetFields.map((f) => ({
      header: cfg.targetFieldHeaders[f] || f,
      key: f,
      width: Math.max((cfg.targetFieldHeaders[f] || f).length + 4, 20)
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    const quotedTable = (0, import_export_worker_utils.quoteIdentifier)(cfg.targetTable);
    const quotedFields = cfg.targetFields.map((f) => (0, import_export_worker_utils.quoteIdentifier)(f)).join(", ");
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const sql = `SELECT ${quotedFields} FROM ${quotedTable} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
      const [rows] = await sequelize.query(sql);
      if (rows.length === 0) {
        hasMore = false;
        continue;
      }
      for (const row of rows) {
        const excelRow = {};
        for (const f of cfg.targetFields) {
          excelRow[f] = (0, import_export_worker_utils.formatValue)(row[f]);
        }
        sheet.addRow(excelRow).commit();
      }
      offset += PAGE_SIZE;
      if (rows.length < PAGE_SIZE) hasMore = false;
      send({ type: "heartbeat", ts: Date.now() });
    }
    sheet.commit();
    send({ type: "log", level: "INFO", message: `\u5173\u8054\u8868 ${cfg.targetTable} sheet \u5BFC\u51FA\u5B8C\u6210` });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  exportAssociationSheets
});
