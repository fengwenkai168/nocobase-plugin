/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var import_service_exports = {};
__export(import_service_exports, {
  insertBatch: () => import_import_utils2.insertBatch,
  insertWithSplit: () => import_import_utils2.insertWithSplit,
  processImportAsync: () => processImportAsync
});
module.exports = __toCommonJS(import_service_exports);
var import_fs = __toESM(require("fs"));
var import_cancel_state = require("./cancel-state");
var import_taskLogs = require("./taskLogs");
var import_import_utils = require("./import-utils");
var import_import_phases = require("./import-phases");
var import_import_phase3 = require("./import-phase3");
var import_import_utils2 = require("./import-utils");
async function processImportAsync(db, taskId, params) {
  const {
    tableName,
    sheetName,
    headerRow,
    fieldMapping,
    customValues,
    importMode,
    uniqueFields,
    blankCellMode,
    fileId
  } = params;
  const repo = db.getRepository("sjgl02_tasks");
  const sequelize = db.sequelize;
  try {
    await sequelize.query("SET SESSION statement_timeout = '5min'");
  } catch {
  }
  const TIMEOUT_MS = 30 * 60 * 1e3;
  const safetyTimer = setTimeout(async () => {
    import_cancel_state.cancelFlags.add(taskId);
    try {
      await repo.update({
        filterByTk: taskId,
        values: { status: "timeout", errorMessage: "\u5BFC\u5165\u6267\u884C\u8D85\u65F6", completedAt: /* @__PURE__ */ new Date() }
      });
    } catch {
    }
  }, TIMEOUT_MS);
  let userId = null;
  try {
    const taskRec = await repo.findOne({ filter: { id: taskId }, raw: true });
    userId = (taskRec == null ? void 0 : taskRec.createdById) ?? null;
  } catch {
  }
  const mapping = fieldMapping || {};
  const custVals = customValues || {};
  const uFields = uniqueFields || [];
  const hRow = parseInt(String(headerRow), 10) || 1;
  const bCellMode = blankCellMode || "update";
  const mode = importMode || "insert";
  let coll;
  try {
    coll = (0, import_import_utils.validateCollectionName)(db, tableName);
  } catch (err) {
    await fail(taskId, db, "\u6570\u636E\u8868\u4E0D\u5B58\u5728: " + err.message);
    return;
  }
  const allowedFieldSet = (0, import_import_utils.getAllowedFieldNames)(coll);
  for (const key of Object.keys(mapping)) {
    if (!allowedFieldSet.has(key)) {
      await fail(taskId, db, "\u5B57\u6BB5 " + key + " \u4E0D\u5B58\u5728\u4E8E\u6570\u636E\u8868 " + tableName);
      return;
    }
  }
  for (const uf of uFields) {
    if (!allowedFieldSet.has(uf)) {
      await fail(taskId, db, "\u552F\u4E00\u503C\u5B57\u6BB5 " + uf + " \u4E0D\u5B58\u5728");
      return;
    }
  }
  let filePath = "";
  try {
    const attachRepo = db.getRepository("attachments");
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      await fail(taskId, db, "\u9644\u4EF6\u8BB0\u5F55\u672A\u627E\u5230: " + fileId);
      return;
    }
    filePath = await (0, import_import_utils.resolveAttachmentFilePath)(db, attachment);
  } catch (err) {
    await fail(taskId, db, "\u89E3\u6790\u6587\u4EF6\u8DEF\u5F84\u5931\u8D25: " + (err.message || String(err)));
    return;
  }
  if (!import_fs.default.existsSync(filePath)) {
    await fail(taskId, db, "\u6587\u4EF6\u672A\u627E\u5230: " + filePath);
    return;
  }
  let shadowTableName = "";
  const errorLogs = [];
  try {
    await repo.update({ filterByTk: taskId, values: { status: "processing" } });
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u5F00\u59CB\u6267\u884C\u5BFC\u5165\u4EFB\u52A1");
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u76EE\u6807\u6570\u636E\u8868: " + tableName);
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u5BFC\u5165\u6A21\u5F0F: " + mode);
    const pkColumns = await (0, import_import_utils.getPrimaryKeyColumns)(sequelize, tableName);
    if (pkColumns.length === 0) {
      throw new Error("\u6570\u636E\u8868 " + tableName + " \u6CA1\u6709\u4E3B\u952E\uFF0C\u65E0\u6CD5\u5BFC\u5165");
    }
    const phase1Result = await (0, import_import_phases.phase1Validate)(
      db,
      taskId,
      filePath,
      sheetName,
      hRow,
      mapping,
      custVals,
      uFields,
      mode,
      pkColumns
    );
    if (!phase1Result.passed) {
      return;
    }
    shadowTableName = "_sjgl02_import_" + taskId;
    const quotedMain = (0, import_import_utils.quoteIdentifier)(tableName);
    const quotedShadow = (0, import_import_utils.quoteIdentifier)(shadowTableName);
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(
        "CREATE TABLE " + quotedShadow + " ( LIKE " + quotedMain + " INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS )",
        { transaction }
      );
      const [colRows] = await sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = :shadowTable AND table_schema = current_schema() ORDER BY ordinal_position",
        { replacements: { shadowTable: shadowTableName }, raw: true, transaction }
      );
      const allColumns = colRows.map((r) => r.column_name);
      await sequelize.query("ALTER TABLE " + quotedShadow + " ADD COLUMN __import_row_id__ BIGSERIAL PRIMARY KEY", {
        transaction
      });
      const autoSystemFields = allColumns.filter(
        (c) => ["id", "createdAt", "updatedAt", "createdById", "updatedById"].includes(c)
      );
      await (0, import_import_utils.dropShadowNotNull)(sequelize, shadowTableName, autoSystemFields, transaction);
      const dataColumns = (0, import_import_utils.resolveMappedDataColumns)(allColumns, mapping, coll, pkColumns);
      if (dataColumns.length === 0) {
        throw new Error("\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u5B57\u6BB5");
      }
      await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u5F71\u5B50\u8868\u5217: " + dataColumns.join(", ") + "\uFF0C\u4E3B\u952E: " + pkColumns.join(", "));
      const phase2Result = await (0, import_import_phases.phase2WriteShadow)(
        db,
        taskId,
        filePath,
        sheetName,
        hRow,
        mapping,
        custVals,
        bCellMode,
        mode,
        uFields,
        coll,
        pkColumns,
        allColumns,
        dataColumns,
        shadowTableName,
        quotedMain,
        quotedShadow,
        transaction,
        phase1Result.headers,
        phase1Result.totalRows,
        userId
      );
      if (phase2Result.errorLogs.length > 0) {
        return;
      }
      if (import_cancel_state.cancelFlags.has(taskId)) {
        await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF08\u9636\u6BB5\u4E8C\u5B8C\u6210\u540E\u68C0\u6D4B\u5230\u53D6\u6D88\u4FE1\u53F7\uFF09");
        return;
      }
      await (0, import_import_phase3.phase3Migrate)(
        db,
        taskId,
        mapping,
        bCellMode,
        mode,
        uFields,
        coll,
        pkColumns,
        allColumns,
        dataColumns,
        shadowTableName,
        quotedMain,
        quotedShadow,
        transaction,
        phase2Result.phase2TotalRows,
        userId
      );
    } catch (phaseErr) {
      try {
        await transaction.rollback();
      } catch {
      }
      try {
        await sequelize.query("DROP TABLE IF EXISTS " + quotedShadow);
      } catch {
      }
      throw phaseErr;
    }
  } catch (err) {
    try {
      const fallbackLogs = errorLogs.length > 0 ? errorLogs : [
        {
          row: 0,
          excelRow: 0,
          reason: err.message || String(err),
          snapshot: "shadowTable=" + (shadowTableName || "?") + ", mode=" + mode + ", phase=\u9636\u6BB5\u4E09"
        }
      ];
      await (0, import_taskLogs.writeTaskLog)(
        db,
        taskId,
        "ERROR",
        "\u5BFC\u5165\u5931\u8D25(" + mode + "\u6A21\u5F0F, \u8868" + tableName + "): " + (err.message || String(err))
      );
      const existingTask = await repo.findOne({ filterByTk: taskId, fields: ["status"] }).catch(() => null);
      const currentStatus = existingTask == null ? void 0 : existingTask.status;
      if (currentStatus !== "timeout" && currentStatus !== "cancelled") {
        await repo.update({
          filterByTk: taskId,
          values: {
            status: "failed",
            errorMessage: err.message || String(err),
            errorLogs: fallbackLogs,
            completedAt: /* @__PURE__ */ new Date()
          }
        });
      }
    } catch {
    }
  } finally {
    clearTimeout(safetyTimer);
    import_cancel_state.cancelFlags.delete(taskId);
  }
}
async function fail(taskId, db, message) {
  try {
    const repo = db.getRepository("sjgl02_tasks");
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", message);
    await repo.update({
      filterByTk: taskId,
      values: { status: "failed", errorMessage: message, completedAt: /* @__PURE__ */ new Date() }
    });
  } catch {
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  insertBatch,
  insertWithSplit,
  processImportAsync
});
