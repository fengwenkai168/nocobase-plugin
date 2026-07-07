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
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_export_worker_utils = require("./export-worker-utils");
var import_export_scalar = require("./export-scalar");
var import_export_association = require("./export-association");
var import_export_attachment = require("./export-attachment");
function send(msg) {
  if (process.send) process.send(msg);
}
console.error("[export-worker] process started, pid:", process.pid, ")");
function getDbConfig() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_DATABASE || "nocobase",
    username: process.env.DB_USER || "nocobase",
    password: process.env.DB_PASSWORD || "nocobase"
  };
}
async function isCancelled(sequelize, taskId) {
  var _a;
  try {
    const [rows] = await sequelize.query('SELECT "status" FROM "sjgl02_tasks" WHERE "id" = $1', {
      bind: [taskId]
    });
    return rows && ((_a = rows[0]) == null ? void 0 : _a.status) === "cancelled";
  } catch {
    return false;
  }
}
async function runSingleExport(msg) {
  console.error("[export-worker] runSingleExport started");
  const {
    taskId,
    tableName,
    fieldHeaders,
    collDisplayName,
    pkStrategy,
    pkField,
    collectionTotal,
    includeAssociationSheet,
    associationSheets,
    includeAttachments,
    fieldMetas,
    tempDir,
    fileNameTemplate
  } = msg;
  try {
    send({ type: "log", level: "INFO", message: `\u5BFC\u51FA\u5B50\u8FDB\u7A0B\u542F\u52A8\uFF0C\u8868: ${tableName}` });
  } catch (e) {
    console.error("[export-worker] send log failed", e);
  }
  const cfg = getDbConfig();
  console.error("[export-worker] db config", cfg);
  const { Sequelize } = require("sequelize");
  console.error("[export-worker] sequelize required");
  const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
    host: cfg.host,
    port: cfg.port,
    dialect: "postgres",
    logging: false,
    dialectOptions: { application_name: "nocobase.export.worker" },
    pool: { max: 3, min: 1, idle: 1e4 }
  });
  console.error("[export-worker] sequelize created");
  try {
    if (!import_fs.default.existsSync(tempDir)) import_fs.default.mkdirSync(tempDir, { recursive: true });
    console.error("[export-worker] temp dir ok", tempDir);
    const baseName = (0, import_export_worker_utils.resolveExportBaseName)(tableName, fileNameTemplate);
    console.error("[export-worker] baseName", baseName);
    const scalarFields = (fieldMetas || []).filter((m) => m.isScalar).map((m) => m.name);
    console.error("[export-worker] scalarFields", scalarFields);
    const scalarFieldHeaders = {};
    for (const f of scalarFields) scalarFieldHeaders[f] = (fieldHeaders == null ? void 0 : fieldHeaders[f]) || f;
    console.error("[export-worker] calling exportScalarTable");
    const scalarResult = await (0, import_export_scalar.exportScalarTable)({
      sequelize,
      tableName,
      fieldNames: scalarFields,
      fieldHeaders: scalarFieldHeaders,
      collDisplayName,
      pkStrategy,
      pkField,
      collectionTotal,
      tempDir,
      fileNameTemplate,
      send,
      isCancelled: () => isCancelled(sequelize, taskId)
    });
    if (includeAssociationSheet && associationSheets && associationSheets.length > 0) {
      await (0, import_export_association.exportAssociationSheets)({
        sequelize,
        workbook: scalarResult.streamWriter,
        associationSheets,
        send,
        isCancelled: () => isCancelled(sequelize, taskId)
      });
    }
    await scalarResult.streamWriter.commit();
    const attachments = await (0, import_export_attachment.collectAttachmentIds)({
      sequelize,
      tableName,
      fieldMetas: fieldMetas || [],
      mainIds: scalarResult.mainIds,
      includeAttachments: includeAttachments || false
    });
    const xlsxPath = scalarResult.filePath;
    const zipPath = import_path.default.join(tempDir, `${baseName}.zip`);
    await (0, import_export_worker_utils.buildExportZip)({ xlsxPath, attachments, outputPath: zipPath, baseName });
    try {
      import_fs.default.unlinkSync(xlsxPath);
    } catch {
    }
    const stats = import_fs.default.statSync(zipPath);
    send({ type: "log", level: "SUCC", message: `\u5BFC\u51FA\u5B8C\u6210\uFF0C\u5171 ${scalarResult.processedRows} \u884C\u6570\u636E\uFF0C\u9644\u4EF6 ${attachments.length} \u4E2A` });
    send({ type: "completed", filePath: zipPath, fileSize: stats.size, processedRows: scalarResult.processedRows });
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error("[export-worker] runSingleExport error", err == null ? void 0 : err.message, err == null ? void 0 : err.stack);
    const message = (err == null ? void 0 : err.message) || String(err);
    try {
      send({ type: "log", level: "ERROR", message: `\u5BFC\u51FA\u5931\u8D25: ${message}` });
    } catch {
    }
    try {
      send({ type: "error", message, stack: err == null ? void 0 : err.stack });
    } catch {
    }
    await sequelize.close().catch(() => {
    });
    process.exit(1);
  }
}
async function runMultiExport(msg) {
  if (!msg.tableList) return;
  const { taskId, tableList, tempDir } = msg;
  send({ type: "log", level: "INFO", message: `\u591A\u8868\u5BFC\u51FA\u542F\u52A8\uFF0C\u5171 ${tableList.length} \u5F20\u8868` });
  const cfg = getDbConfig();
  const { Sequelize } = require("sequelize");
  const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
    host: cfg.host,
    port: cfg.port,
    dialect: "postgres",
    logging: false,
    dialectOptions: { application_name: "nocobase.export.multi" },
    pool: { max: 3, min: 1, idle: 1e4 }
  });
  if (!import_fs.default.existsSync(tempDir)) import_fs.default.mkdirSync(tempDir, { recursive: true });
  const xlsxDir = import_path.default.join(tempDir, `export_${taskId}_${Date.now()}`);
  import_fs.default.mkdirSync(xlsxDir, { recursive: true });
  let totalProcessed = 0;
  const totalRows = tableList.reduce((s, t) => s + t.collectionTotal, 0);
  const xlsxFiles = [];
  try {
    for (let i = 0; i < tableList.length; i++) {
      const tableCfg = tableList[i];
      send({
        type: "log",
        level: "INFO",
        message: `\u6B63\u5728\u5BFC\u51FA [${i + 1}/${tableList.length}] ${tableCfg.collDisplayName}(${tableCfg.tableName})`
      });
      const { filePath, processedRows } = await (0, import_export_scalar.exportScalarTable)({
        sequelize,
        tableName: tableCfg.tableName,
        fieldNames: tableCfg.fieldNames,
        fieldHeaders: tableCfg.fieldHeaders,
        collDisplayName: tableCfg.collDisplayName,
        pkStrategy: tableCfg.pkStrategy,
        pkField: tableCfg.pkField,
        collectionTotal: tableCfg.collectionTotal,
        tempDir: xlsxDir,
        send,
        isCancelled: () => isCancelled(sequelize, taskId)
      });
      xlsxFiles.push(filePath);
      totalProcessed += processedRows;
      const pct = Math.min(95, Math.floor(totalProcessed / Math.max(1, totalRows) * 100));
      send({ type: "progress", processedRows: totalProcessed, totalRows, progress: pct });
      send({ type: "heartbeat", ts: Date.now() });
    }
    send({ type: "log", level: "INFO", message: `\u6B63\u5728\u6253\u5305 ${xlsxFiles.length} \u4E2A Excel \u6587\u4EF6\u4E3A tar.gz` });
    const archiver = require("archiver");
    const tarName = `\u5168\u90E8\u6570\u636E\u8868_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.tar.gz`;
    const tarPath = import_path.default.join(tempDir, tarName);
    const output = import_fs.default.createWriteStream(tarPath);
    const archive = archiver("tar", { gzip: true, gzipOptions: { level: 6 } });
    await new Promise((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      for (const f of xlsxFiles) {
        archive.file(f, { name: import_path.default.basename(f) });
      }
      archive.finalize();
    });
    for (const f of xlsxFiles) {
      try {
        import_fs.default.unlinkSync(f);
      } catch {
      }
    }
    try {
      import_fs.default.rmdirSync(xlsxDir);
    } catch {
    }
    const stats = import_fs.default.statSync(tarPath);
    send({ type: "log", level: "SUCC", message: `\u591A\u8868\u5BFC\u51FA\u5B8C\u6210\uFF0C\u5171 ${tableList.length} \u5F20\u8868\uFF0C${totalProcessed} \u884C\u6570\u636E` });
    send({ type: "completed", filePath: tarPath, fileSize: stats.size, processedRows: totalProcessed });
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    send({ type: "log", level: "ERROR", message: `\u591A\u8868\u5BFC\u51FA\u5931\u8D25: ${err.message}` });
    send({ type: "error", message: err.message || String(err), stack: err.stack });
    await sequelize.close().catch(() => {
    });
    process.exit(1);
  }
}
process.on("message", (msg) => {
  console.error("[export-worker] received message", msg == null ? void 0 : msg.type);
  if (msg.type === "start") {
    if (msg.tableName === "__all__" && msg.tableList) {
      runMultiExport(msg);
    } else {
      runSingleExport(msg);
    }
  }
  if (msg.type === "cancel") {
    send({ type: "log", level: "WARN", message: "\u6536\u5230\u53D6\u6D88\u4FE1\u53F7" });
    process.exit(0);
  }
});
process.on("uncaughtException", (err) => {
  console.error("[export-worker] uncaughtException", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("[export-worker] unhandledRejection", err);
  process.exit(1);
});
try {
  send({ type: "heartbeat", ts: Date.now() });
  console.error("[export-worker] heartbeat sent");
} catch (e) {
  console.error("[export-worker] heartbeat send failed", e);
  process.exit(1);
}
