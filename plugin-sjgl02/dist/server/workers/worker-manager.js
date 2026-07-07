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
var worker_manager_exports = {};
__export(worker_manager_exports, {
  activeWorkers: () => activeWorkers,
  forkExportWorker: () => forkExportWorker,
  killWorker: () => killWorker
});
module.exports = __toCommonJS(worker_manager_exports);
var import_child_process = require("child_process");
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_exceljs = __toESM(require("exceljs"));
const HEARTBEAT_TIMEOUT = 12e4;
const SIGTERM_GRACE = 1e4;
const MAX_TASK_DURATION = 30 * 60 * 1e3;
const activeWorkers = /* @__PURE__ */ new Map();
function getWorkerPath() {
  const candidate = import_path.default.join(__dirname, "export-worker.js");
  if (import_fs.default.existsSync(candidate)) return candidate;
  return import_path.default.resolve(__dirname, "..", "..", "..", "dist", "server", "workers", "export-worker.js");
}
function killWorker(child) {
  if (child.exitCode !== null) return;
  try {
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, SIGTERM_GRACE);
  } catch {
  }
}
async function logStderrToTask(taskId, repo, prefix, stderr) {
  if (!stderr) return;
  try {
    const logRepo = repo.db.getRepository("sjgl02_task_logs");
    await logRepo.create({
      values: { taskId, level: "ERROR", message: `${prefix}
${stderr.substring(0, 8e3)}`, timestamp: /* @__PURE__ */ new Date() }
    });
  } catch {
  }
}
async function runExportInline(msg, db) {
  var _a;
  const {
    taskId,
    tableName,
    fieldNames,
    fieldHeaders,
    collDisplayName,
    tempDir,
    pkStrategy,
    pkField,
    fileNameTemplate,
    fieldMetas
  } = msg;
  const targetRepo = db.getRepository(tableName);
  if (!targetRepo) throw new Error(`\u8868 ${tableName} \u4E0D\u5B58\u5728`);
  if (!import_fs.default.existsSync(tempDir)) import_fs.default.mkdirSync(tempDir, { recursive: true });
  let fname;
  if (fileNameTemplate) {
    const d = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
      d.getMinutes()
    )}${pad(d.getSeconds())}`;
    const tbl = db.getCollection(tableName);
    const rawName = ((_a = tbl == null ? void 0 : tbl.options) == null ? void 0 : _a.title) || (tbl == null ? void 0 : tbl.name) || tableName;
    fname = fileNameTemplate.replace(/\{表名\}/g, rawName).replace(/\{日期\}/g, date) + ".xlsx";
  } else {
    fname = `sjgl02_export_${taskId}_${Date.now()}.xlsx`;
  }
  const filePath = import_path.default.join(tempDir, fname);
  const streamWriter = new import_exceljs.default.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false
  });
  const sheet = streamWriter.addWorksheet(collDisplayName.substring(0, 31).replace(/[\\/:*?[\]]/g, "_"));
  const scalarFieldNames = fieldMetas && fieldMetas.length > 0 ? fieldMetas.filter((m) => m.isScalar).map((m) => m.name) : fieldNames.filter((f) => !["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f));
  sheet.columns = scalarFieldNames.map((f) => ({ header: fieldHeaders[f] || f, key: f, width: 20 }));
  sheet.getRow(1).font = { bold: true };
  let processedRows = 0;
  const PAGE_SIZE = 2e3;
  if (pkStrategy === "cursor" && pkField) {
    let lastId = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await targetRepo.find({
        filter: { [pkField]: { $gt: lastId } },
        sort: [pkField],
        limit: PAGE_SIZE,
        raw: true
      });
      if (page.length === 0) {
        hasMore = false;
        continue;
      }
      for (const r of page) {
        const row = {};
        for (const f of scalarFieldNames) row[f] = r[f] ?? "";
        sheet.addRow(row).commit();
        processedRows++;
      }
      lastId = Number(page[page.length - 1][pkField]);
    }
  } else {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await targetRepo.find({ filter: {}, offset, limit: PAGE_SIZE, raw: true });
      if (page.length === 0) {
        hasMore = false;
        continue;
      }
      for (const r of page) {
        const row = {};
        for (const f of scalarFieldNames) row[f] = r[f] ?? "";
        sheet.addRow(row).commit();
        processedRows++;
      }
      offset += PAGE_SIZE;
    }
  }
  sheet.commit();
  await streamWriter.commit();
  const stats = import_fs.default.statSync(filePath);
  const storageDir = process.env.STORAGE_DIR || "storage/uploads";
  const attachRepo = db.getRepository("attachments");
  const attachment = await attachRepo.create({
    values: {
      title: import_path.default.basename(filePath),
      filename: import_path.default.basename(filePath),
      extname: ".xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: stats.size,
      path: import_path.default.relative(storageDir, filePath).replace(/\\/g, "/")
    }
  });
  const repo = db.getRepository("sjgl02_tasks");
  await repo.update({
    filterByTk: taskId,
    values: {
      status: "completed",
      progress: 100,
      processedRows,
      exportFileId: attachment.id,
      fileName: attachment.filename || "",
      completedAt: /* @__PURE__ */ new Date()
    }
  });
}
function forkExportWorker(taskId, startMsg, repo, storedDb) {
  var _a;
  const workerPath = getWorkerPath();
  if (!import_fs.default.existsSync(workerPath)) {
    setImmediate(async () => {
      try {
        await runExportInline(startMsg, storedDb || repo.db);
      } catch (e) {
        await repo.update({
          filterByTk: taskId,
          values: { status: "failed", errorMessage: (e == null ? void 0 : e.message) || String(e), completedAt: /* @__PURE__ */ new Date() }
        }).catch(() => {
        });
      }
    });
    return null;
  }
  const child = (0, import_child_process.fork)(workerPath, [], { silent: true, execArgv: [] });
  const STDERR_MAX_SIZE = 10240;
  let stderrBuf = "";
  (_a = child.stderr) == null ? void 0 : _a.on("data", (chunk) => {
    if (stderrBuf.length < STDERR_MAX_SIZE) {
      stderrBuf += chunk.toString("utf8");
      if (stderrBuf.length > STDERR_MAX_SIZE) {
        stderrBuf = stderrBuf.slice(0, STDERR_MAX_SIZE);
      }
    }
  });
  activeWorkers.set(taskId, child);
  let lastHeartbeat = 0;
  let resolved = false;
  let forkedFailed = false;
  let lastCompletedFilePath = null;
  let forkTimeout = setTimeout(() => {
    if (!resolved) {
      forkedFailed = true;
      killWorker(child);
    }
  }, 15e3);
  function resetForkTimeout() {
    clearTimeout(forkTimeout);
    forkTimeout = setTimeout(() => {
      if (!resolved) {
        forkedFailed = true;
        killWorker(child);
      }
    }, 15e3);
  }
  const heartbeatTimer = setInterval(() => {
    if (resolved || forkedFailed) return;
    const elapsed = Date.now() - lastHeartbeat;
    if (lastHeartbeat > 0 && elapsed > HEARTBEAT_TIMEOUT) {
      forkedFailed = true;
      killWorker(child);
      setImmediate(async () => {
        try {
          await runExportInline(startMsg, storedDb || repo.db);
        } catch (e) {
          await repo.update({
            filterByTk: taskId,
            values: { status: "failed", errorMessage: (e == null ? void 0 : e.message) || String(e), completedAt: /* @__PURE__ */ new Date() }
          }).catch(() => {
          });
        }
      });
    }
  }, 3e4);
  const maxDurationTimer = setTimeout(() => {
    if (!resolved) {
      killWorker(child);
    }
  }, MAX_TASK_DURATION);
  function cleanup() {
    if (resolved) return;
    resolved = true;
    clearTimeout(forkTimeout);
    clearInterval(heartbeatTimer);
    clearTimeout(maxDurationTimer);
    activeWorkers.delete(taskId);
  }
  child.on("message", async (msg) => {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "heartbeat":
        lastHeartbeat = Date.now();
        resetForkTimeout();
        break;
      case "progress":
        try {
          await repo.update({
            filterByTk: taskId,
            values: { processedRows: msg.processedRows, totalRows: msg.totalRows, progress: msg.progress }
          });
        } catch {
        }
        break;
      case "log":
        try {
          const logRepo = repo.db.getRepository("sjgl02_task_logs");
          await logRepo.create({ values: { taskId, level: msg.level, message: msg.message, timestamp: /* @__PURE__ */ new Date() } });
        } catch {
        }
        break;
      case "completed":
        lastCompletedFilePath = msg.filePath;
        try {
          await repo.update({
            filterByTk: taskId,
            values: { fileName: msg.filePath, processedRows: msg.processedRows }
          });
        } catch {
        }
        break;
      case "error":
        break;
    }
  });
  child.on("exit", (code, signal) => {
    cleanup();
    if (forkedFailed) {
      setImmediate(async () => {
        try {
          await runExportInline(startMsg, storedDb || repo.db);
        } catch (e) {
          await repo.update({
            filterByTk: taskId,
            values: { status: "failed", errorMessage: (e == null ? void 0 : e.message) || String(e), completedAt: /* @__PURE__ */ new Date() }
          }).catch(() => {
          });
        }
      });
      return;
    }
    const exitOk = code === 0 && !signal;
    (async () => {
      if (exitOk) {
        try {
          const task = await repo.findOne({ filterByTk: taskId, raw: true });
          if (!task) return;
          const fileName = (task == null ? void 0 : task.fileName) || lastCompletedFilePath || "";
          if (!fileName) return;
          const { resolveAttachmentFromFile } = await import("../actions/export");
          const exportFileId = await resolveAttachmentFromFile(repo.db, fileName, taskId);
          if (exportFileId) {
            await repo.update({
              filterByTk: taskId,
              values: { exportFileId, status: "completed", progress: 100, completedAt: /* @__PURE__ */ new Date() }
            });
            const logRepo = repo.db.getRepository("sjgl02_task_logs");
            await logRepo.create({
              values: {
                taskId,
                level: "SUCC",
                message: `\u5BFC\u51FA\u5B8C\u6210\uFF0C\u5171 ${(task == null ? void 0 : task.processedRows) || 0} \u884C\u6570\u636E`,
                timestamp: /* @__PURE__ */ new Date()
              }
            }).catch(() => {
            });
          }
        } catch (err) {
          await repo.update({
            filterByTk: taskId,
            values: { status: "failed", errorMessage: `\u6536\u5C3E\u9636\u6BB5\u5931\u8D25: ${err.message}`, completedAt: /* @__PURE__ */ new Date() }
          });
        }
      } else if (signal === "SIGTERM" || signal === "SIGKILL") {
        const task = await repo.findOne({ filterByTk: taskId, fields: ["status"] }).catch(() => null);
        if (!task) return;
        const status = task == null ? void 0 : task.status;
        if (status !== "cancelled") {
          await repo.update({
            filterByTk: taskId,
            values: { status: "timeout", errorMessage: "\u4EFB\u52A1\u6267\u884C\u8D85\u65F6", completedAt: /* @__PURE__ */ new Date() }
          });
        }
      } else {
        const errDetail = stderrBuf ? `
stderr: ${stderrBuf.substring(0, 500)}` : "";
        const errorMessage = `Worker exit code ${code}${errDetail}`;
        await repo.update({
          filterByTk: taskId,
          values: { status: "failed", errorMessage, completedAt: /* @__PURE__ */ new Date() }
        });
        logStderrToTask(taskId, repo, `Worker exit code ${code}`, stderrBuf).catch(() => {
        });
      }
    })();
  });
  child.on("error", async (err) => {
    cleanup();
    try {
      await repo.update({
        filterByTk: taskId,
        values: { status: "failed", errorMessage: `Worker error: ${err.message}`, completedAt: /* @__PURE__ */ new Date() }
      });
    } catch {
    }
    try {
      const logRepo = repo.db.getRepository("sjgl02_task_logs");
      await logRepo.create({
        values: { taskId, level: "ERROR", message: `Worker error: ${err.message}`, timestamp: /* @__PURE__ */ new Date() }
      });
      await logStderrToTask(taskId, repo, "Worker stderr", stderrBuf);
    } catch {
    }
  });
  child.send(startMsg);
  return child;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activeWorkers,
  forkExportWorker,
  killWorker
});
