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
var import_phases_exports = {};
__export(import_phases_exports, {
  phase1Validate: () => phase1Validate,
  phase2WriteShadow: () => phase2WriteShadow
});
module.exports = __toCommonJS(import_phases_exports);
var import_cancel_state = require("./cancel-state");
var import_taskLogs = require("./taskLogs");
var import_import_utils = require("./import-utils");
var import_excel_parser = require("./excel-parser");
async function phase1Validate(db, taskId, filePath, sheetName, hRow, mapping, custVals, uFields, mode, pkColumns) {
  const repo = db.getRepository("sjgl02_tasks");
  await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E00\uFF1A\u6D41\u5F0F\u9884\u6821\u9A8C\u5F00\u59CB...");
  const errorLogs = [];
  const seenUniqueValues = /* @__PURE__ */ new Set();
  const seenPkValues = /* @__PURE__ */ new Set();
  let cancelled = false;
  let headers = [];
  const result = await new Promise((resolve, reject) => {
    (0, import_excel_parser.streamProcessExcel)(
      filePath,
      sheetName,
      hRow,
      async (rowNum, dataIdx, vals) => {
        if (import_cancel_state.cancelFlags.has(taskId)) {
          cancelled = true;
          return false;
        }
        if (dataIdx < 0) return true;
        if ((0, import_import_utils.isEmptyRow)(vals, headers, mapping)) return true;
        const record = (0, import_import_utils.makeRecord)(vals, headers, mapping, custVals);
        if ((mode === "update" || mode === "upsert") && uFields.length > 0) {
          const emptyUFields = uFields.filter(
            (uf) => record[uf] === void 0 || record[uf] === "" || record[uf] === null
          );
          if (emptyUFields.length > 0) {
            if (errorLogs.length < 1e3) {
              errorLogs.push({
                row: dataIdx + 1,
                excelRow: rowNum,
                reason: "\u552F\u4E00\u503C\u5B57\u6BB5\u4E3A\u7A7A\uFF08" + emptyUFields.join(", ") + "\uFF09",
                snapshot: (0, import_import_utils.buildSnapshot)(vals, headers, mapping, custVals)
              });
            }
          } else {
            const ufKey = uFields.map((uf) => record[uf]).join("||");
            if (seenUniqueValues.has(ufKey)) {
              if (errorLogs.length < 1e3) {
                errorLogs.push({
                  row: dataIdx + 1,
                  excelRow: rowNum,
                  reason: "Excel \u5185\u90E8\u552F\u4E00\u503C\u91CD\u590D: " + uFields.join("+") + " = " + ufKey,
                  snapshot: (0, import_import_utils.buildSnapshot)(vals, headers, mapping, custVals)
                });
              }
            } else {
              seenUniqueValues.add(ufKey);
            }
          }
        }
        for (const pk of pkColumns) {
          if (mapping[pk] && mapping[pk] !== "__ignore__") {
            const pkVal = record[pk];
            if (pkVal !== void 0 && pkVal !== "" && pkVal !== null) {
              const pkKey = String(pkVal);
              if (seenPkValues.has(pkKey)) {
                if (errorLogs.length < 1e3) {
                  errorLogs.push({
                    row: dataIdx + 1,
                    excelRow: rowNum,
                    reason: "Excel \u5185\u90E8\u4E3B\u952E\u91CD\u590D: " + pk + " = " + pkKey,
                    snapshot: (0, import_import_utils.buildSnapshot)(vals, headers, mapping, custVals)
                  });
                }
              } else {
                seenPkValues.add(pkKey);
              }
            }
          }
        }
        return true;
      },
      (h) => {
        headers = h;
      }
    ).then((r) => {
      resolve({
        passed: !cancelled && errorLogs.length === 0,
        headers: r.headers,
        totalRows: r.totalRows
      });
    }).catch(reject);
  });
  if (cancelled) {
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF08\u9636\u6BB5\u4E00\uFF09");
    await repo.update({ filterByTk: taskId, values: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } });
    return { passed: false, headers: result.headers, totalRows: result.totalRows, errorLogs };
  }
  await repo.update({ filterByTk: taskId, values: { totalRows: result.totalRows } });
  await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", "\u9636\u6BB5\u4E00\u9884\u6821\u9A8C\u5B8C\u6210\uFF0C\u5171 " + result.totalRows + " \u884C\u6709\u6548\u6570\u636E");
  if (!result.passed) {
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", "\u9636\u6BB5\u4E00\u9884\u6821\u9A8C\u5931\u8D25\uFF0C\u5171 " + errorLogs.length + " \u4E2A\u9519\u8BEF");
    await repo.update({
      filterByTk: taskId,
      values: {
        status: "failed",
        errorLogs,
        errorMessage: "\u9884\u6821\u9A8C\u5931\u8D25: " + errorLogs.length + " \u4E2A\u9519\u8BEF",
        completedAt: /* @__PURE__ */ new Date()
      }
    });
  }
  return { ...result, errorLogs };
}
async function phase2WriteShadow(db, taskId, filePath, sheetName, hRow, mapping, custVals, bCellMode, mode, uFields, coll, pkColumns, allColumns, dataColumns, shadowTableName, quotedMain, quotedShadow, transaction, phase1Headers, phase1TotalRows, userId) {
  const repo = db.getRepository("sjgl02_tasks");
  const sequelize = db.sequelize;
  await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E8C\uFF1A\u5F71\u5B50\u8868\u5199\u5165\u5F00\u59CB...");
  const BATCH_SIZE = Math.max(1, Math.min(2e3, Math.floor(3e4 / dataColumns.length)));
  const quotedCols = dataColumns.map((c) => (0, import_import_utils.quoteIdentifier)(c)).join(", ");
  let batch = [];
  let phase2Processed = 0;
  let phase2Cancelled = false;
  const phase2ErrorLogs = [];
  const flushBatch = async () => {
    if (batch.length === 0) return;
    try {
      await (0, import_import_utils.insertBatch)(sequelize, quotedShadow, quotedCols, dataColumns, batch, transaction);
    } catch (batchErr) {
      await (0, import_taskLogs.writeTaskLog)(
        db,
        taskId,
        "WARN",
        "\u6279\u6B21\u5199\u5165\u5931\u8D25\uFF1A" + (batchErr.message || String(batchErr)) + "\uFF0C\u9010\u884C\u5B9A\u4F4D..."
      );
      const splitLogs = await (0, import_import_utils.insertWithSplit)(
        sequelize,
        quotedShadow,
        quotedCols,
        dataColumns,
        batch,
        phase2Processed - batch.length,
        transaction
      );
      if (splitLogs.length > 0) {
        phase2ErrorLogs.push(...splitLogs);
        if (phase2ErrorLogs.length > 1e3) phase2ErrorLogs.splice(1e3);
        throw new Error(splitLogs.length + " \u884C\u5199\u5165\u5931\u8D25");
      }
    }
    batch = [];
  };
  await new Promise((resolve, reject) => {
    (0, import_excel_parser.streamProcessExcel)(
      filePath,
      sheetName,
      hRow,
      async (rowNum, dataIdx, vals) => {
        if (import_cancel_state.cancelFlags.has(taskId)) {
          phase2Cancelled = true;
          return false;
        }
        if (dataIdx < 0) return true;
        if ((0, import_import_utils.isEmptyRow)(vals, phase1Headers, mapping)) return true;
        const record = (0, import_import_utils.makeRecord)(vals, phase1Headers, mapping, custVals);
        (0, import_import_utils.applyBelongsToFK)(record, phase1Headers, vals, mapping, coll);
        const converted = (0, import_import_utils.convertRecordValues)(record, coll);
        const rowVals = dataColumns.map((c) => converted[c] !== void 0 ? converted[c] : null);
        batch.push(rowVals);
        phase2Processed++;
        if (batch.length >= BATCH_SIZE) {
          try {
            await flushBatch();
          } catch (e) {
            reject(e);
            return false;
          }
          const prog = 50 + Math.floor(phase2Processed / Math.max(phase1TotalRows, 1) * 40);
          try {
            await repo.update({
              filterByTk: taskId,
              values: { progress: Math.min(90, prog), processedRows: phase2Processed }
            });
          } catch {
          }
        }
        if (phase2Processed % 1e3 === 0 && import_cancel_state.cancelFlags.has(taskId)) {
          phase2Cancelled = true;
          return false;
        }
        return true;
      },
      (headers) => {
        if (phase1Headers.length === 0) phase1Headers = headers;
      }
    ).then(async () => {
      try {
        await flushBatch();
        resolve();
      } catch (e) {
        reject(e);
      }
    }).catch(reject);
  });
  if (phase2Cancelled || import_cancel_state.cancelFlags.has(taskId)) {
    await sequelize.query("DROP TABLE IF EXISTS " + quotedShadow, { transaction });
    await transaction.commit();
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "WARN", "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF08\u9636\u6BB5\u4E8C\uFF09");
    await repo.update({ filterByTk: taskId, values: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } });
    return { phase2TotalRows: 0, errorLogs: [] };
  }
  if (phase2ErrorLogs.length > 0) {
    await sequelize.query("DROP TABLE IF EXISTS " + quotedShadow, { transaction });
    await transaction.commit();
    for (let i = 0; i < Math.min(10, phase2ErrorLogs.length); i++) {
      const log = phase2ErrorLogs[i];
      await (0, import_taskLogs.writeTaskLog)(
        db,
        taskId,
        "ERROR",
        "\u7B2C " + (log.row || i + 1) + " \u884C\u5199\u5165\u5931\u8D25\uFF1A" + log.reason + "\uFF0C\u5FEB\u7167\uFF1A" + (log.snapshot || "{}")
      );
    }
    await (0, import_taskLogs.writeTaskLog)(db, taskId, "ERROR", "\u9636\u6BB5\u4E8C\u5199\u5165\u5931\u8D25\uFF0C\u5171 " + phase2ErrorLogs.length + " \u4E2A\u9519\u8BEF");
    await repo.update({
      filterByTk: taskId,
      values: {
        status: "failed",
        errorLogs: phase2ErrorLogs,
        errorMessage: "\u9636\u6BB5\u4E8C\u5199\u5165\u5931\u8D25: " + phase2ErrorLogs.length + " \u884C\u6570\u636E\u5F02\u5E38",
        completedAt: /* @__PURE__ */ new Date()
      }
    });
    return { phase2TotalRows: 0, errorLogs: phase2ErrorLogs };
  }
  const phase2TotalRows = phase2Processed;
  await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", "\u9636\u6BB5\u4E8C\u5F71\u5B50\u8868\u5199\u5165\u5B8C\u6210\uFF0C\u5171 " + phase2TotalRows + " \u884C");
  await repo.update({ filterByTk: taskId, values: { progress: 90, processedRows: phase2TotalRows } });
  return { phase2TotalRows, errorLogs: [] };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  phase1Validate,
  phase2WriteShadow
});
