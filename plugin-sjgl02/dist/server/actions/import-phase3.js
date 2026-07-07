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
var import_phase3_exports = {};
__export(import_phase3_exports, {
  phase3Migrate: () => phase3Migrate
});
module.exports = __toCommonJS(import_phase3_exports);
var import_cancel_state = require("./cancel-state");
var import_taskLogs = require("./taskLogs");
var import_import_utils = require("./import-utils");
function buildRecordFromShadow(row, dataColumns, pkColumns, mapping, allColumns, userId) {
  const rec = {};
  for (const col of dataColumns) {
    rec[col] = row[col];
  }
  for (const pk of pkColumns) {
    if (!mapping[pk] || mapping[pk] === "__ignore__") {
      delete rec[pk];
    } else if (rec[pk] === null || rec[pk] === "" || rec[pk] === void 0) {
      delete rec[pk];
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (allColumns.includes("createdById") && !dataColumns.includes("createdById") && userId != null) {
    rec.createdById = userId;
  }
  if (allColumns.includes("updatedById") && !dataColumns.includes("updatedById") && userId != null) {
    rec.updatedById = userId;
  }
  if (allColumns.includes("createdAt") && !dataColumns.includes("createdAt")) {
    rec.createdAt = now;
  }
  if (allColumns.includes("updatedAt") && !dataColumns.includes("updatedAt")) {
    rec.updatedAt = now;
  }
  return rec;
}
async function fixCreatedSystemFields(instances, sourceRows, options, sequelize, dataColumns, allColumns, pkColumns, userId, targetTableName) {
  if (instances.length === 0 || sourceRows.length === 0) return;
  const sysFields = [];
  if (allColumns.includes("createdById")) sysFields.push("createdById");
  if (allColumns.includes("updatedById")) sysFields.push("updatedById");
  if (allColumns.includes("createdAt")) sysFields.push("createdAt");
  if (allColumns.includes("updatedAt")) sysFields.push("updatedAt");
  if (sysFields.length === 0) return;
  const pkAttr = pkColumns[0] || "id";
  const valueRows = [];
  const replacements = {};
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const row = sourceRows[i];
    const id = inst.get(pkAttr);
    const placeholders = [`:id${i}`];
    for (const f of sysFields) {
      const key = `${f}${i}`;
      placeholders.push(`:${key}`);
    }
    valueRows.push(`(${placeholders.join(", ")})`);
    replacements[`id${i}`] = id;
    for (const f of sysFields) {
      const key = `${f}${i}`;
      if (f === "createdById") replacements[key] = dataColumns.includes("createdById") ? row.createdById : userId;
      if (f === "updatedById") replacements[key] = dataColumns.includes("updatedById") ? row.updatedById : userId;
      if (f === "createdAt") replacements[key] = dataColumns.includes("createdAt") ? row.createdAt : null;
      if (f === "updatedAt") replacements[key] = dataColumns.includes("updatedAt") ? row.updatedAt : null;
    }
  }
  const setClauses = [];
  if (allColumns.includes("createdById")) {
    setClauses.push(`${(0, import_import_utils.quoteIdentifier)("createdById")} = v.${(0, import_import_utils.quoteIdentifier)("createdById")}::bigint`);
  }
  if (allColumns.includes("updatedById")) {
    setClauses.push(`${(0, import_import_utils.quoteIdentifier)("updatedById")} = v.${(0, import_import_utils.quoteIdentifier)("updatedById")}::bigint`);
  }
  if (allColumns.includes("createdAt")) {
    setClauses.push(
      `${(0, import_import_utils.quoteIdentifier)("createdAt")} = COALESCE(v.${(0, import_import_utils.quoteIdentifier)(
        "createdAt"
      )}::timestamp with time zone, m.${(0, import_import_utils.quoteIdentifier)("createdAt")})`
    );
  }
  if (allColumns.includes("updatedAt")) {
    setClauses.push(
      `${(0, import_import_utils.quoteIdentifier)("updatedAt")} = COALESCE(v.${(0, import_import_utils.quoteIdentifier)(
        "updatedAt"
      )}::timestamp with time zone, m.${(0, import_import_utils.quoteIdentifier)("updatedAt")})`
    );
  }
  const sql = `
    UPDATE ${(0, import_import_utils.quoteIdentifier)(targetTableName)} AS m
    SET ${setClauses.join(", ")}
    FROM (VALUES ${valueRows.join(", ")})
    AS v(${(0, import_import_utils.quoteIdentifier)(pkAttr)}, ${sysFields.map((f) => (0, import_import_utils.quoteIdentifier)(f)).join(", ")})
    WHERE m.${(0, import_import_utils.quoteIdentifier)(pkAttr)} = v.${(0, import_import_utils.quoteIdentifier)(pkAttr)}
  `;
  await sequelize.query(sql, { replacements, transaction: options.transaction });
}
async function readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction) {
  const PHASE3_BATCH_SIZE = 5e3;
  const [rows] = await sequelize.query(
    "SELECT " + dataColumns.map((c) => (0, import_import_utils.quoteIdentifier)(c)).join(", ") + ", __import_row_id__ FROM " + quotedShadow + " WHERE __import_row_id__ > :lastRowId ORDER BY __import_row_id__ LIMIT :limit",
    { replacements: { lastRowId, limit: PHASE3_BATCH_SIZE }, raw: true, transaction }
  );
  return rows;
}
async function checkPkConflicts(sequelize, mapping, pkColumns, quotedMain, quotedShadow, transaction) {
  const mappedPkColumns = pkColumns.filter((pk) => mapping[pk] && mapping[pk] !== "__ignore__");
  if (mappedPkColumns.length === 0) return;
  const pkNullChecks = mappedPkColumns.map((pk) => "s." + (0, import_import_utils.quoteIdentifier)(pk) + " IS NOT NULL").join(" AND ");
  const pkMatchChecks = mappedPkColumns.map((pk) => "m." + (0, import_import_utils.quoteIdentifier)(pk) + " = s." + (0, import_import_utils.quoteIdentifier)(pk)).join(" AND ");
  const [conflicts] = await sequelize.query(
    "SELECT " + mappedPkColumns.map((c) => "m." + (0, import_import_utils.quoteIdentifier)(c)).join(", ") + " FROM " + quotedMain + " m WHERE EXISTS (SELECT 1 FROM " + quotedShadow + " s WHERE " + pkMatchChecks + " AND " + pkNullChecks + ") LIMIT 1",
    { raw: true, transaction }
  );
  if (conflicts.length > 0) {
    const sample = conflicts[0];
    const sampleKey = mappedPkColumns.map((pk) => pk + "=" + sample[pk]).join(", ");
    throw new Error("\u4E3B\u952E\u503C\u4E0E\u6570\u636E\u5E93\u5DF2\u6709\u8BB0\u5F55\u51B2\u7A81\uFF08" + sampleKey + "\uFF09");
  }
}
async function phase3UpdateMode(db, taskId, mapping, bCellMode, uFields, pkColumns, allColumns, dataColumns, quotedMain, quotedShadow, transaction, phase2TotalRows, userId) {
  const repo = db.getRepository("sjgl02_tasks");
  const sequelize = db.sequelize;
  const setCols = dataColumns.filter((c) => !pkColumns.includes(c));
  const setClauses = [];
  for (const col of setCols) {
    if (bCellMode === "skip") {
      setClauses.push(
        (0, import_import_utils.quoteIdentifier)(col) + " = COALESCE(s." + (0, import_import_utils.quoteIdentifier)(col) + ", m." + (0, import_import_utils.quoteIdentifier)(col) + ")"
      );
    } else {
      setClauses.push((0, import_import_utils.quoteIdentifier)(col) + " = s." + (0, import_import_utils.quoteIdentifier)(col));
    }
  }
  for (const f of ["updatedAt", "updatedById"]) {
    if (allColumns.includes(f) && !dataColumns.includes(f)) {
      setClauses.push(
        (0, import_import_utils.quoteIdentifier)(f) + " = " + (f === "updatedAt" ? "NOW()" : (userId != null ? String(userId) : "NULL") + "::bigint")
      );
    }
  }
  const whereClauses = uFields.map((uf) => "m." + (0, import_import_utils.quoteIdentifier)(uf) + " = s." + (0, import_import_utils.quoteIdentifier)(uf)).join(" AND ");
  if (setClauses.length === 0 || !whereClauses) {
    throw new Error("\u66F4\u65B0\u6A21\u5F0F\u7F3A\u5C11\u53EF\u66F4\u65B0\u5B57\u6BB5\u6216\u552F\u4E00\u503C\u5B57\u6BB5");
  }
  let processedCount = 0;
  let updatedCount = 0;
  let lastRowId = 0;
  let batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  while (batchRows.length > 0) {
    if (import_cancel_state.cancelFlags.has(taskId)) throw new Error("\u4EFB\u52A1\u5DF2\u53D6\u6D88");
    const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;
    const [result] = await sequelize.query(
      "UPDATE " + quotedMain + " m SET " + setClauses.join(", ") + " FROM " + quotedShadow + " s WHERE " + whereClauses + " AND s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId RETURNING m.id",
      { replacements: { lastRowId, maxRowId }, transaction }
    );
    updatedCount += result.length;
    processedCount += batchRows.length;
    lastRowId = maxRowId;
    const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
    try {
      await repo.update({
        filterByTk: taskId,
        values: { progress: Math.min(98, prog), processedRows: processedCount }
      });
    } catch {
    }
    batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  }
  return { processedCount, updatedCount };
}
async function phase3InsertMode(db, taskId, mapping, uFields, coll, pkColumns, allColumns, dataColumns, quotedMain, quotedShadow, transaction, phase2TotalRows, userId) {
  const repo = db.getRepository("sjgl02_tasks");
  const sequelize = db.sequelize;
  const targetRepo = db.getRepository(coll.name);
  await checkPkConflicts(sequelize, mapping, pkColumns, quotedMain, quotedShadow, transaction);
  let processedCount = 0;
  let lastRowId = 0;
  let batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  while (batchRows.length > 0) {
    if (import_cancel_state.cancelFlags.has(taskId)) throw new Error("\u4EFB\u52A1\u5DF2\u53D6\u6D88");
    const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;
    const records = batchRows.map(
      (row) => buildRecordFromShadow(row, dataColumns, pkColumns, mapping, allColumns, userId)
    );
    const instances = await targetRepo.create({
      values: records,
      transaction,
      context: { state: { currentUser: { id: userId } } }
    });
    await fixCreatedSystemFields(
      instances,
      batchRows,
      { transaction },
      sequelize,
      dataColumns,
      allColumns,
      pkColumns,
      userId,
      coll.name
    );
    processedCount += batchRows.length;
    lastRowId = maxRowId;
    const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
    try {
      await repo.update({
        filterByTk: taskId,
        values: { progress: Math.min(98, prog), processedRows: processedCount }
      });
    } catch {
    }
    batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  }
  return { processedCount, updatedCount: 0 };
}
async function phase3UpsertMode(db, taskId, mapping, bCellMode, uFields, coll, pkColumns, allColumns, dataColumns, quotedMain, quotedShadow, transaction, phase2TotalRows, userId) {
  const repo = db.getRepository("sjgl02_tasks");
  const sequelize = db.sequelize;
  const targetRepo = db.getRepository(coll.name);
  let processedCount = 0;
  let updatedCount = 0;
  let lastRowId = 0;
  let batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  while (batchRows.length > 0) {
    if (import_cancel_state.cancelFlags.has(taskId)) throw new Error("\u4EFB\u52A1\u5DF2\u53D6\u6D88");
    const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;
    const setCols = dataColumns.filter((c) => !uFields.includes(c) && !pkColumns.includes(c));
    const setClauses = [];
    for (const col of setCols) {
      if (bCellMode === "skip") {
        setClauses.push(
          (0, import_import_utils.quoteIdentifier)(col) + " = COALESCE(s." + (0, import_import_utils.quoteIdentifier)(col) + ", m." + (0, import_import_utils.quoteIdentifier)(col) + ")"
        );
      } else {
        setClauses.push((0, import_import_utils.quoteIdentifier)(col) + " = s." + (0, import_import_utils.quoteIdentifier)(col));
      }
    }
    for (const f of ["updatedAt", "updatedById"]) {
      if (allColumns.includes(f) && !dataColumns.includes(f)) {
        setClauses.push(
          (0, import_import_utils.quoteIdentifier)(f) + " = " + (f === "updatedAt" ? "NOW()" : (userId != null ? String(userId) : "NULL") + "::bigint")
        );
      }
    }
    const whereClauses = uFields.map((uf) => "m." + (0, import_import_utils.quoteIdentifier)(uf) + " = s." + (0, import_import_utils.quoteIdentifier)(uf)).join(" AND ");
    if (uFields.length > 0 && setClauses.length > 0) {
      const [updateResult] = await sequelize.query(
        "UPDATE " + quotedMain + " m SET " + setClauses.join(", ") + " FROM " + quotedShadow + " s WHERE " + whereClauses + " AND s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId RETURNING m.id",
        { replacements: { lastRowId, maxRowId }, transaction }
      );
      updatedCount += updateResult.length;
    }
    const [newRows] = await sequelize.query(
      "SELECT s.* FROM " + quotedShadow + " s WHERE s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId" + (uFields.length > 0 ? " AND NOT EXISTS (SELECT 1 FROM " + quotedMain + " m WHERE " + uFields.map((uf) => "m." + (0, import_import_utils.quoteIdentifier)(uf) + " = s." + (0, import_import_utils.quoteIdentifier)(uf)).join(" AND ") + ")" : ""),
      { replacements: { lastRowId, maxRowId }, raw: true, transaction }
    );
    const records = newRows.map(
      (row) => buildRecordFromShadow(row, dataColumns, pkColumns, mapping, allColumns, userId)
    );
    if (records.length > 0) {
      const instances = await targetRepo.create({
        values: records,
        transaction,
        context: { state: { currentUser: { id: userId } } }
      });
      await fixCreatedSystemFields(
        instances,
        newRows,
        { transaction },
        sequelize,
        dataColumns,
        allColumns,
        pkColumns,
        userId,
        coll.name
      );
    }
    processedCount += batchRows.length;
    lastRowId = maxRowId;
    const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
    try {
      await repo.update({
        filterByTk: taskId,
        values: { progress: Math.min(98, prog), processedRows: processedCount }
      });
    } catch {
    }
    batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  }
  return { processedCount, updatedCount };
}
async function phase3Migrate(db, taskId, mapping, bCellMode, mode, uFields, coll, pkColumns, allColumns, dataColumns, shadowTableName, quotedMain, quotedShadow, transaction, phase2TotalRows, userId) {
  const repo = db.getRepository("sjgl02_tasks");
  const sequelize = db.sequelize;
  await (0, import_taskLogs.writeTaskLog)(db, taskId, "INFO", "\u9636\u6BB5\u4E09\uFF1A\u539F\u5B50\u8FC1\u79FB\u5F00\u59CB...");
  try {
    await sequelize.query("SET LOCAL statement_timeout = '30min'", { transaction });
  } catch {
  }
  let processedCount = 0;
  let updatedCount = 0;
  if (mode === "update") {
    const result = await phase3UpdateMode(
      db,
      taskId,
      mapping,
      bCellMode,
      uFields,
      pkColumns,
      allColumns,
      dataColumns,
      quotedMain,
      quotedShadow,
      transaction,
      phase2TotalRows,
      userId
    );
    processedCount = result.processedCount;
    updatedCount = result.updatedCount;
  } else if (mode === "upsert") {
    const result = await phase3UpsertMode(
      db,
      taskId,
      mapping,
      bCellMode,
      uFields,
      coll,
      pkColumns,
      allColumns,
      dataColumns,
      quotedMain,
      quotedShadow,
      transaction,
      phase2TotalRows,
      userId
    );
    processedCount = result.processedCount;
    updatedCount = result.updatedCount;
  } else {
    const result = await phase3InsertMode(
      db,
      taskId,
      mapping,
      uFields,
      coll,
      pkColumns,
      allColumns,
      dataColumns,
      quotedMain,
      quotedShadow,
      transaction,
      phase2TotalRows,
      userId
    );
    processedCount = result.processedCount;
    updatedCount = result.updatedCount;
  }
  await sequelize.query("DROP TABLE IF EXISTS " + quotedShadow, { transaction });
  const successMsg = mode === "update" ? "\u8FC1\u79FB\u5B8C\u6210\uFF0C\u66F4\u65B0 " + updatedCount + " \u884C\uFF0C\u5F71\u5B50\u8868\u5DF2\u5220\u9664" : mode === "upsert" ? "\u8FC1\u79FB\u5B8C\u6210\uFF0C\u66F4\u65B0 " + updatedCount + " \u884C\uFF0C\u65B0\u589E " + (processedCount - updatedCount) + " \u884C\uFF0C\u5F71\u5B50\u8868\u5DF2\u5220\u9664" : "\u8FC1\u79FB\u5B8C\u6210\uFF0C\u5171 " + processedCount + " \u884C\uFF0C\u5F71\u5B50\u8868\u5DF2\u5220\u9664";
  await (0, import_taskLogs.writeTaskLog)(db, taskId, "SUCC", successMsg);
  await repo.update({
    filterByTk: taskId,
    values: { status: "completed", progress: 100, processedRows: processedCount, completedAt: /* @__PURE__ */ new Date() }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  phase3Migrate
});
