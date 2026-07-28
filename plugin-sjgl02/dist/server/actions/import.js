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
var import_exports = {};
__export(import_exports, {
  registerImportActions: () => registerImportActions
});
module.exports = __toCommonJS(import_exports);
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = __toESM(require("node:path"));
var import_utils = require("@nocobase/utils");
var import_utils2 = require("./utils");
var tar = __toESM(require("tar-stream"));
var import_permission = require("../services/permission");
var import_import_engine = require("../services/import-engine");
var import_excel_parser = require("../services/excel-parser");
var import_field_meta = require("../services/field-meta");
var import_attachment = require("../services/attachment");
function sjgl02Dir(...parts) {
  return (0, import_utils.storagePathJoin)(import_node_path.default.join("sjgl02", ...parts));
}
function assertSjgl02Path(filePath) {
  const base = import_node_path.default.resolve(sjgl02Dir());
  const resolved = import_node_path.default.resolve(filePath);
  if (!resolved.startsWith(base + import_node_path.default.sep) && resolved !== base) {
    throw new Error("\u975E\u6CD5\u6587\u4EF6\u8DEF\u5F84");
  }
}
async function saveUpload(ctx) {
  var _a;
  const upload = (0, import_utils.koaMulter)({
    storage: import_utils.koaMulter.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024, files: 1 }
  }).single("file");
  await upload(ctx, () => {
  });
  const file = ctx["file"];
  if (!file) {
    throw new Error("\u672A\u63A5\u6536\u5230\u6587\u4EF6\uFF08\u5B57\u6BB5\u540D\u5E94\u4E3A file\uFF09");
  }
  const body = ((_a = ctx.request) == null ? void 0 : _a.body) || {};
  const kind = body.kind || "excel";
  const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
  const subDir = kind === "excel" ? "imports" : "attachment-archives";
  const dir = sjgl02Dir(subDir);
  await import_promises.default.mkdir(dir, { recursive: true });
  const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${import_node_path.default.basename(originalName)}`;
  const filePath = import_node_path.default.join(dir, storedName);
  await import_promises.default.writeFile(filePath, file.buffer);
  return { filePath, originalName, size: file.size, kind };
}
async function quickRowCount(filePath, fileKind, sheetName, headerRow) {
  if (fileKind === "xlsx") {
    const sheets = await (0, import_excel_parser.listSheets)(filePath, fileKind);
    const sheet = sheets.find((s) => s.name === sheetName);
    return Math.max(((sheet == null ? void 0 : sheet.rowCount) ?? 0) - headerRow, 0);
  }
  const preview = await (0, import_excel_parser.readPreview)(filePath, fileKind, sheetName, headerRow, 1);
  return preview.totalRows;
}
async function buildTemplateArchive() {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();
    const chunks = [];
    pack.on("data", (chunk) => chunks.push(chunk));
    pack.on("end", () => resolve(Buffer.concat(chunks)));
    pack.on("error", reject);
    const readme = [
      "\u9644\u4EF6\u538B\u7F29\u5305\u4F7F\u7528\u8BF4\u660E\uFF1A",
      "1. \u5C06\u9644\u4EF6\u6587\u4EF6\u6309\u6587\u4EF6\u5939\u5206\u7C7B\u6574\u7406\uFF08\u5982 photos/\u3001docs/\uFF09\uFF0C\u538B\u7F29\u4E3A tar.gz \u683C\u5F0F",
      "2. \u4E0A\u4F20\u540E\uFF0C\u5728\u5B57\u6BB5\u6620\u5C04\u7684\u300C\u914D\u7F6E\u300D\u5217\u4E3A\u6BCF\u4E2A\u9644\u4EF6\u5B57\u6BB5\u624B\u52A8\u9009\u62E9\u5BF9\u5E94\u6587\u4EF6\u5939\uFF08\u5FC5\u9009\uFF09",
      "3. Excel \u9644\u4EF6\u5217\u586B\u5199\u6587\u4EF6\u540D\uFF08\u542B\u6269\u5C55\u540D\uFF09\uFF0C\u591A\u4E2A\u9644\u4EF6\u7528\u9017\u53F7\u5206\u9694",
      "4. \u7CFB\u7EDF\u4ECE\u8BE5\u5B57\u6BB5\u9009\u4E2D\u7684\u6587\u4EF6\u5939\u4E2D\u67E5\u627E\u540C\u540D\u6587\u4EF6\uFF0C\u538B\u7F29\u5305\u5185\u6587\u4EF6\u540D\u5FC5\u987B\u4E0E Excel \u4E2D\u586B\u5199\u7684\u5B8C\u5168\u4E00\u81F4"
    ].join("\n");
    pack.entry({ name: "\u8BF4\u660E.txt" }, readme, (err) => {
      if (err) return reject(err);
      pack.entry({ name: "photos/" }, (err2) => {
        if (err2) return reject(err2);
        pack.finalize();
      });
    });
  });
}
function registerImportActions(plugin) {
  const permissionService = new import_permission.PermissionService(plugin);
  const engine = new import_import_engine.ImportEngine(plugin);
  plugin.taskQueue.registerHandler("import", async (ctx, params) => {
    return engine.run(ctx, params);
  });
  return {
    importUpload: async (ctx, next) => {
      const saved = await saveUpload(ctx);
      const kind = saved.kind;
      if (kind === "attachment") {
        const folders = await (0, import_attachment.listArchiveFolders)(saved.filePath).catch(() => []);
        ctx.body = { filePath: saved.filePath, fileName: saved.originalName, size: saved.size, folders };
        return next();
      }
      const fileKind = (0, import_excel_parser.detectFileKind)(saved.originalName);
      if (!fileKind) {
        await import_promises.default.unlink(saved.filePath).catch(() => {
        });
        ctx.throw(400, "\u4EC5\u652F\u6301 .xlsx / .xls / .csv \u683C\u5F0F\u6587\u4EF6");
      }
      const sheets = await (0, import_excel_parser.listSheets)(saved.filePath, fileKind);
      ctx.body = {
        filePath: saved.filePath,
        fileName: saved.originalName,
        size: saved.size,
        fileKind,
        sheets,
        rowLimit: import_excel_parser.ROW_LIMITS[fileKind]
      };
      await next();
    },
    previewExcel: async (ctx, next) => {
      const __p = { ...ctx.action.params || {}, ...ctx.action.params.values || {} };
      const { filePath, fileKind, sheetName, headerRow = 1 } = __p;
      if (!filePath || !fileKind || !sheetName) {
        ctx.throw(400, "\u7F3A\u5C11\u53C2\u6570 filePath/fileKind/sheetName");
      }
      assertSjgl02Path(filePath);
      const preview = await (0, import_excel_parser.readPreview)(filePath, fileKind, sheetName, Number(headerRow), 10);
      ctx.body = { headers: preview.headers, previewRows: preview.rows, totalRows: preview.totalRows };
      await next();
    },
    getImportPermissions: async (ctx, next) => {
      const userId = (0, import_utils2.currentUserId)(ctx);
      const __p = { ...ctx.action.params || {}, ...ctx.action.params.values || {} };
      const { collectionName } = __p;
      const permissions = await permissionService.listImportPermissions(userId, collectionName || void 0);
      ctx.body = { permissions };
      await next();
    },
    importableCollections: async (ctx, next) => {
      const userId = (0, import_utils2.currentUserId)(ctx);
      const roleNames = await permissionService.getUserRoleNames(userId);
      const isAdmin = permissionService.isAdmin(roleNames);
      let names;
      if (isAdmin) {
        names = new Set([...plugin.db.collections.values()].map((c) => c.name));
      } else {
        names = /* @__PURE__ */ new Set();
        const models = await plugin.db.getRepository("sjgl02Permissions").find({
          filter: {
            canImport: true,
            $or: [
              { targetType: "user", targetId: String(userId) },
              ...roleNames.length ? [{ targetType: "role", targetId: { $in: roleNames } }] : []
            ]
          }
        });
        for (const m of models) names.add(m.get("collectionName"));
      }
      const collections = [...plugin.db.collections.values()].filter((c) => names.has(c.name)).map((c) => ({ name: c.name, title: (0, import_field_meta.cleanTitle)(c.options.title, c.name) }));
      ctx.body = { collections };
      await next();
    },
    import: async (ctx, next) => {
      var _a;
      const values = ctx.action.params.values || {};
      const required = ["filePath", "fileName", "fileKind", "sheetName", "collectionName", "mode", "mapping"];
      for (const key of required) {
        if (values[key] === void 0 || values[key] === null || values[key] === "") {
          ctx.throw(400, `\u7F3A\u5C11\u53C2\u6570 ${key}`);
        }
      }
      assertSjgl02Path(String(values.filePath));
      if (!import_node_fs.default.existsSync(String(values.filePath))) {
        ctx.throw(400, "\u4E0A\u4F20\u6587\u4EF6\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u4E0A\u4F20");
      }
      if (values.attachmentArchivePath) {
        assertSjgl02Path(String(values.attachmentArchivePath));
        if (!import_node_fs.default.existsSync(String(values.attachmentArchivePath))) {
          ctx.throw(400, "\u9644\u4EF6\u538B\u7F29\u5305\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u4E0A\u4F20");
        }
      }
      const fileKind = String(values.fileKind);
      const headerRow = Number(values.headerRow || 1);
      const rowCount = await quickRowCount(String(values.filePath), fileKind, String(values.sheetName), headerRow);
      const limit = import_excel_parser.ROW_LIMITS[fileKind];
      if (rowCount > limit) {
        ctx.throw(400, `\u6587\u4EF6\u884C\u6570 ${rowCount} \u8D85\u8FC7 ${fileKind} \u683C\u5F0F\u4E0A\u9650 ${limit} \u884C`);
      }
      const userId = (0, import_utils2.currentUserId)(ctx);
      const mapping = values.mapping || [];
      const mappingFields = mapping.filter((m) => m.source !== "ignore").map((m) => m.field);
      const { config } = await permissionService.getPermissionForExecution(
        userId,
        values.permissionConfigId === void 0 || values.permissionConfigId === null ? null : Number(values.permissionConfigId)
      );
      permissionService.assertImportParams(config, {
        mode: String(values.mode),
        mappingFields,
        uniqueFields: values.uniqueFields || []
      });
      if (values.attachmentArchivePath) {
        for (const m of mapping) {
          if (m.source === "ignore") continue;
          const meta = (0, import_field_meta.buildFieldMeta)(plugin.db, String(values.collectionName), m.field);
          if ((meta == null ? void 0 : meta.attachment) && !((_a = m.config) == null ? void 0 : _a.folder)) {
            ctx.throw(400, `\u9644\u4EF6\u5B57\u6BB5 ${meta.title}(${m.field}) \u672A\u9009\u62E9\u538B\u7F29\u5305\u5185\u6587\u4EF6\u5939`);
          }
        }
      }
      const collection = plugin.db.getCollection(String(values.collectionName));
      const operatorUserId = userId;
      const taskParams = {
        filePath: String(values.filePath),
        fileName: String(values.fileName),
        fileKind,
        sheetName: String(values.sheetName),
        headerRow,
        collectionName: String(values.collectionName),
        mode: values.mode,
        uniqueFields: values.uniqueFields || [],
        blankStrategy: values.blankStrategy || "clear",
        mapping,
        requiredFields: config.requiredFields,
        attachmentArchivePath: values.attachmentArchivePath ? String(values.attachmentArchivePath) : void 0,
        operatorUserId,
        plannedRows: rowCount
      };
      const task = await plugin.taskQueue.submit("import", taskParams, userId, {
        title: `${(collection == null ? void 0 : collection.options.title) || values.collectionName} \u5BFC\u5165`,
        collectionName: String(values.collectionName),
        collectionTitle: String((collection == null ? void 0 : collection.options.title) || values.collectionName),
        fileName: String(values.fileName),
        filePath: String(values.filePath),
        permissionConfigId: config.id ?? void 0,
        permissionType: config.targetType,
        permissionLabel: config.targetName ? `${config.targetType === "user" ? "\u{1F464}" : "\u{1F465}"} ${config.targetName}` : void 0
      });
      ctx.body = { taskId: task.get("id"), rowCount };
      await next();
    },
    downloadTemplate: async (ctx, next) => {
      const buffer = await buildTemplateArchive();
      const zlib = await import("node:zlib");
      ctx.set("Content-Type", "application/gzip");
      ctx.set("Content-Disposition", 'attachment; filename="attachments-template.tar.gz"');
      ctx.body = zlib.gzipSync(buffer);
      await next();
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerImportActions
});
