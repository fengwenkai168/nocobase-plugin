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
var export_attachment_exports = {};
__export(export_attachment_exports, {
  collectAttachmentIds: () => collectAttachmentIds
});
module.exports = __toCommonJS(export_attachment_exports);
var import_export_worker_utils = require("./export-worker-utils");
async function collectAttachmentIds(options) {
  const { sequelize, fieldMetas, includeAttachments } = options;
  if (!includeAttachments) return [];
  const attachmentFields = fieldMetas.filter((m) => m.isAttachment);
  if (attachmentFields.length === 0) return [];
  const attachmentIdSet = /* @__PURE__ */ new Set();
  for (const meta of attachmentFields) {
    if (meta.type === "integer") {
      const rows = await queryColumn(sequelize, options.tableName, meta.name);
      for (const r of rows) {
        const v = r[meta.name];
        if (v !== null && v !== void 0) attachmentIdSet.add(v);
      }
      continue;
    }
    if (meta.type === "belongsToMany" && meta.through && meta.otherKey) {
      const rows = await queryBelongsToMany(
        sequelize,
        meta.through,
        meta.foreignKey || `${options.tableName}Id`,
        meta.otherKey,
        options.mainIds
      );
      for (const r of rows) {
        const v = r[meta.otherKey];
        if (v !== null && v !== void 0) attachmentIdSet.add(v);
      }
    }
  }
  if (attachmentIdSet.size === 0) return [];
  return queryAttachmentInfos(sequelize, Array.from(attachmentIdSet));
}
async function queryColumn(sequelize, tableName, columnName) {
  try {
    const sql = `SELECT ${(0, import_export_worker_utils.quoteIdentifier)(columnName)} FROM ${(0, import_export_worker_utils.quoteIdentifier)(tableName)} WHERE ${(0, import_export_worker_utils.quoteIdentifier)(
      columnName
    )} IS NOT NULL`;
    const [rows] = await sequelize.query(sql);
    return rows || [];
  } catch {
    return [];
  }
}
async function queryBelongsToMany(sequelize, through, foreignKey, otherKey, mainIds) {
  try {
    if (mainIds.length === 0) return [];
    const placeholders = mainIds.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `SELECT ${(0, import_export_worker_utils.quoteIdentifier)(foreignKey)}, ${(0, import_export_worker_utils.quoteIdentifier)(
      otherKey
    )} FROM ${(0, import_export_worker_utils.quoteIdentifier)(through)} WHERE ${(0, import_export_worker_utils.quoteIdentifier)(foreignKey)} IN (${placeholders})`;
    const [rows] = await sequelize.query(sql, { bind: mainIds });
    return rows || [];
  } catch {
    return [];
  }
}
async function queryAttachmentInfos(sequelize, ids) {
  if (ids.length === 0) return [];
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `SELECT id, filename, path FROM ${(0, import_export_worker_utils.quoteIdentifier)("attachments")} WHERE id IN (${placeholders})`;
    const [rows] = await sequelize.query(sql, { bind: ids });
    return (rows || []).map((r) => ({
      id: r.id,
      filename: r.filename || `attachment_${r.id}`,
      path: r.path || ""
    }));
  } catch {
    return [];
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  collectAttachmentIds
});
