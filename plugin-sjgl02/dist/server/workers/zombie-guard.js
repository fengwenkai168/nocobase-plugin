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
var zombie_guard_exports = {};
__export(zombie_guard_exports, {
  activeWorkers: () => import_worker_manager.activeWorkers,
  importTimers: () => importTimers,
  startSerialScheduler: () => startSerialScheduler,
  stopSerialScheduler: () => stopSerialScheduler,
  triggerExportScheduler: () => triggerExportScheduler,
  triggerImportScheduler: () => triggerImportScheduler
});
module.exports = __toCommonJS(zombie_guard_exports);
var import_worker_manager = require("./worker-manager");
var import_worker_utils = require("./worker-utils");
var import_cancel_state = require("../actions/cancel-state");
const SCAN_INTERVAL = 3e4;
const MAX_TASK_DURATION = 30 * 60 * 1e3;
const importTimers = /* @__PURE__ */ new Map();
let storedDb = null;
let exportInterval = null;
let isExportScheduling = false;
const runExportSchedule = async () => {
  var _a;
  if (!storedDb) return;
  if (isExportScheduling) return;
  isExportScheduling = true;
  const db = storedDb;
  const repo = db.getRepository("sjgl02_tasks");
  try {
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1e3);
    const stuckTasks = await repo.find({
      filter: { taskType: "export", status: "processing", updatedAt: { $lt: stuckThreshold } },
      fields: ["id"],
      raw: true
    });
    if (stuckTasks.length > 0) {
      for (const t of stuckTasks) {
        await repo.update({
          filterByTk: t.id,
          values: { status: "failed", errorMessage: "\u4EFB\u52A1\u8D85\u65F6\uFF1A\u5B50\u8FDB\u7A0B\u65E0\u54CD\u5E94\uFF08\u50F5\u5C38\u68C0\u6D4B\uFF09", completedAt: /* @__PURE__ */ new Date() }
        }).catch(() => {
        });
      }
    }
    const processingCount = await repo.count({ filter: { taskType: "export", status: "processing" } });
    if (processingCount > 0) return;
    const [nextExport] = await repo.find({
      filter: { taskType: "export", status: "pending" },
      sort: ["id"],
      limit: 1,
      raw: true
    });
    if (!nextExport) return;
    const taskId = nextExport.id;
    const rec = nextExport;
    const headerStyle = rec.headerStyle || "title_id";
    const includeAttachments = rec.includeAttachments || false;
    if (rec.tableName === "__all__") {
      const tableListConfig = rec.selectedFields || [];
      if (tableListConfig.length === 0) {
        await repo.update({
          filterByTk: taskId,
          values: { status: "failed", errorMessage: "\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u8868", completedAt: /* @__PURE__ */ new Date() }
        });
        return;
      }
      const tableList = [];
      for (const cfg of tableListConfig) {
        const c = db.getCollection(cfg.tableName);
        if (!c) continue;
        let fn = ((_a = cfg.fields) == null ? void 0 : _a.length) > 0 ? cfg.fields : (0, import_worker_utils.getScalarFieldNames)(c);
        if (!(fn == null ? void 0 : fn.length)) {
          const bel = (0, import_worker_utils.getRelationFieldNames)(c, ["belongsTo"]);
          fn = bel.length > 0 ? bel : (0, import_worker_utils.getRelationFieldNames)(c, ["hasOne", "hasMany", "belongsToMany"]);
        }
        if (!(fn == null ? void 0 : fn.length)) continue;
        const fh = {};
        for (const f of fn) fh[f] = (0, import_worker_utils.getFieldDisplayName)(c, f, headerStyle);
        const pkInfo2 = (0, import_worker_utils.detectPkStrategy)(c);
        let ct = 0;
        try {
          const r = db.getRepository(cfg.tableName);
          if (r) ct = await r.count({ filter: {} });
        } catch {
        }
        tableList.push({
          tableName: cfg.tableName,
          fieldNames: fn,
          fieldHeaders: fh,
          collDisplayName: (0, import_worker_utils.getCollDisplayName)(c, headerStyle),
          pkStrategy: pkInfo2.strategy,
          pkField: pkInfo2.pkField,
          collectionTotal: ct
        });
      }
      if (tableList.length === 0) {
        await repo.update({
          filterByTk: taskId,
          values: { status: "failed", errorMessage: "\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u8868\uFF08\u5168\u90E8\u8868\u4E0D\u5B58\u5728\u6216\u65E0\u5B57\u6BB5\uFF09", completedAt: /* @__PURE__ */ new Date() }
        });
        return;
      }
      const totalRows = tableList.reduce((s, t) => s + t.collectionTotal, 0);
      await repo.update({
        filterByTk: taskId,
        values: { status: "processing", totalRows, startedAt: /* @__PURE__ */ new Date() }
      });
      const startMsg2 = {
        type: "start",
        taskId,
        tableName: "__all__",
        fieldNames: [],
        filter: {},
        headerStyle,
        pkStrategy: "cursor",
        pkField: null,
        collectionTotal: totalRows,
        includeAttachments,
        attachmentFieldNames: [],
        fileIdFieldNames: [],
        fieldHeaders: {},
        collDisplayName: "\u5168\u90E8\u6570\u636E\u8868",
        tempDir: (0, import_worker_utils.resolveTempDir)(),
        fileNameTemplate: rec.fileNameTemplate || "",
        tableList
      };
      (0, import_worker_manager.forkExportWorker)(taskId, startMsg2, repo, storedDb);
      return;
    }
    const coll = db.getCollection(rec.tableName);
    if (!coll) {
      await repo.update({
        filterByTk: taskId,
        values: { status: "failed", errorMessage: `\u8868 ${rec.tableName} \u4E0D\u5B58\u5728`, completedAt: /* @__PURE__ */ new Date() }
      });
      return;
    }
    const selectedFields = rec.selectedFields || [];
    let fieldNames = selectedFields.length > 0 ? selectedFields : (0, import_worker_utils.getScalarFieldNames)(coll);
    if (!(fieldNames == null ? void 0 : fieldNames.length)) {
      const belongsToFields = (0, import_worker_utils.getRelationFieldNames)(coll, ["belongsTo"]);
      if (belongsToFields.length > 0) {
        fieldNames = belongsToFields;
      } else {
        fieldNames = (0, import_worker_utils.getRelationFieldNames)(coll, ["hasOne", "hasMany", "belongsToMany"]);
      }
    }
    if (!(fieldNames == null ? void 0 : fieldNames.length)) {
      await repo.update({
        filterByTk: taskId,
        values: { status: "failed", errorMessage: "\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u5B57\u6BB5", completedAt: /* @__PURE__ */ new Date() }
      });
      return;
    }
    const fieldMetas = (0, import_worker_utils.getFieldMetas)(coll, fieldNames);
    const scalarFieldNames = fieldMetas.filter((m) => m.isScalar).map((m) => m.name);
    const fieldHeaders = {};
    for (const f of fieldNames) {
      fieldHeaders[f] = (0, import_worker_utils.getFieldDisplayName)(coll, f, headerStyle);
    }
    const pkInfo = (0, import_worker_utils.detectPkStrategy)(coll);
    const pkStrategy = pkInfo.strategy;
    const pkField = pkInfo.pkField;
    let collectionTotal = 0;
    try {
      const tRepo = db.getRepository(rec.tableName);
      if (tRepo) collectionTotal = await tRepo.count({ filter: {} });
    } catch {
    }
    const associationSheetTables = rec.associationSheetTables || [];
    const associationSheets = rec.includeAssociationSheet && associationSheetTables.length > 0 ? (0, import_worker_utils.getAssociationSheetConfigs)(db, coll, fieldNames, associationSheetTables, headerStyle) : [];
    const collDisplayName = (0, import_worker_utils.getCollDisplayName)(coll, headerStyle);
    await repo.update({
      filterByTk: taskId,
      values: { status: "processing", totalRows: rec.totalRows || collectionTotal, startedAt: /* @__PURE__ */ new Date() }
    });
    const startMsg = {
      type: "start",
      taskId,
      tableName: rec.tableName,
      fieldNames,
      selectedFields,
      filter: {},
      headerStyle,
      pkStrategy,
      pkField,
      collectionTotal,
      includeAttachments,
      fieldMetas,
      includeAssociationSheet: rec.includeAssociationSheet || false,
      associationSheetTables,
      associationSheets,
      fieldHeaders,
      collDisplayName,
      tempDir: (0, import_worker_utils.resolveTempDir)(),
      fileNameTemplate: rec.fileNameTemplate || ""
    };
    (0, import_worker_manager.forkExportWorker)(taskId, startMsg, repo, storedDb);
  } catch {
  } finally {
    isExportScheduling = false;
  }
};
let importInterval = null;
let importTimeoutCheckInterval = null;
let isImportScheduling = false;
const runImportSchedule = async () => {
  if (!storedDb) return;
  if (isImportScheduling) return;
  isImportScheduling = true;
  const db = storedDb;
  const repo = db.getRepository("sjgl02_tasks");
  try {
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1e3);
    const importStuckTasks = await repo.find({
      filter: { taskType: "import", status: "processing", updatedAt: { $lt: stuckThreshold } },
      fields: ["id"],
      raw: true
    });
    if (importStuckTasks.length > 0) {
      for (const t of importStuckTasks) {
        importTimers.delete(t.id);
        await repo.update({
          filterByTk: t.id,
          values: { status: "failed", errorMessage: "\u4EFB\u52A1\u8D85\u65F6\uFF1A\u5BFC\u5165\u8FDB\u7A0B\u65E0\u54CD\u5E94\uFF08\u50F5\u5C38\u68C0\u6D4B\uFF09", completedAt: /* @__PURE__ */ new Date() }
        }).catch(() => {
        });
      }
    }
    const importProcessingCount = await repo.count({ filter: { taskType: "import", status: "processing" } });
    if (importProcessingCount > 0) return;
    const nextImport = await repo.findOne({
      filter: { taskType: "import", status: "pending" },
      sort: ["id"]
    });
    if (!nextImport) return;
    const taskId = nextImport.id;
    const rec = nextImport;
    if (!rec.tableName || !rec.importFileId) {
      await repo.update({
        filterByTk: taskId,
        values: {
          status: "failed",
          errorMessage: `\u5BFC\u5165\u4EFB\u52A1\u6570\u636E\u4E0D\u5B8C\u6574: tableName=${rec.tableName}, importFileId=${rec.importFileId}`,
          completedAt: /* @__PURE__ */ new Date()
        }
      });
      return;
    }
    await repo.update({ filterByTk: taskId, values: { status: "processing", startedAt: /* @__PURE__ */ new Date() } });
    importTimers.set(taskId, Date.now());
    setImmediate(async () => {
      try {
        const { processImportAsync } = await import("../actions/import");
        const rec2 = nextImport;
        await processImportAsync(db, taskId, {
          tableName: rec2.tableName,
          fileId: rec2.importFileId,
          sheetName: rec2.sheetName,
          headerRow: rec2.headerRow,
          fieldMapping: rec2.fieldMapping || {},
          customValues: rec2.customValues || {},
          importMode: rec2.importMode,
          uniqueFields: rec2.uniqueFields || [],
          blankCellMode: rec2.blankCellMode
        });
      } catch {
      } finally {
        importTimers.delete(taskId);
      }
    });
  } catch {
  } finally {
    isImportScheduling = false;
  }
};
const runImportTimeoutCheck = async () => {
  if (!storedDb) return;
  for (const [tid, started] of importTimers) {
    if (Date.now() - started > MAX_TASK_DURATION) {
      try {
        import_cancel_state.cancelFlags.add(tid);
        const t = await storedDb.getRepository("sjgl02_tasks").findOne({ filterByTk: tid, fields: ["status"] });
        if (t && (t == null ? void 0 : t.status) === "processing") {
          await storedDb.getRepository("sjgl02_tasks").update({
            filterByTk: tid,
            values: { status: "timeout", errorMessage: "\u4EFB\u52A1\u6267\u884C\u8D85\u65F6", completedAt: /* @__PURE__ */ new Date() }
          });
        }
      } catch {
      }
      importTimers.delete(tid);
    }
  }
};
function startSerialScheduler(db) {
  storedDb = db;
  if (!exportInterval) {
    exportInterval = setInterval(runExportSchedule, SCAN_INTERVAL);
    runExportSchedule();
  }
  if (!importInterval) {
    importInterval = setInterval(runImportSchedule, SCAN_INTERVAL);
    runImportSchedule();
  }
  if (!importTimeoutCheckInterval) {
    importTimeoutCheckInterval = setInterval(runImportTimeoutCheck, 1e4);
  }
}
function stopSerialScheduler() {
  if (exportInterval) {
    clearInterval(exportInterval);
    exportInterval = null;
  }
  if (importInterval) {
    clearInterval(importInterval);
    importInterval = null;
  }
  if (importTimeoutCheckInterval) {
    clearInterval(importTimeoutCheckInterval);
    importTimeoutCheckInterval = null;
  }
  for (const [, child] of import_worker_manager.activeWorkers) {
    (0, import_worker_manager.killWorker)(child);
  }
  import_worker_manager.activeWorkers.clear();
}
function triggerExportScheduler() {
  runExportSchedule();
}
function triggerImportScheduler() {
  runImportSchedule();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activeWorkers,
  importTimers,
  startSerialScheduler,
  stopSerialScheduler,
  triggerExportScheduler,
  triggerImportScheduler
});
