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
var attachment_exports = {};
__export(attachment_exports, {
  attachmentExists: () => attachmentExists,
  createAttachmentRecord: () => createAttachmentRecord,
  extractAttachmentArchive: () => extractAttachmentArchive,
  getStorageInfo: () => getStorageInfo,
  isAllowedAttachment: () => isAllowedAttachment,
  listArchiveFolders: () => listArchiveFolders
});
module.exports = __toCommonJS(attachment_exports);
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = __toESM(require("node:path"));
var import_node_zlib = __toESM(require("node:zlib"));
var tar = __toESM(require("tar-stream"));
var import_utils = require("@nocobase/utils");
function normalizeEntryName(name) {
  return name.replace(/^\.\//, "").replace(/^attachments\/?/, "");
}
async function extractAttachmentArchive(archivePath, destDir) {
  await import_promises.default.rm(destDir, { recursive: true, force: true });
  await import_promises.default.mkdir(destDir, { recursive: true });
  const files = /* @__PURE__ */ new Map();
  await new Promise((resolve, reject) => {
    const extract = tar.extract();
    extract.on("entry", (header, stream, next) => {
      const normalized = normalizeEntryName(header.name);
      const parts = normalized.split("/").filter(Boolean);
      if (header.type !== "file" || parts.length < 2) {
        stream.resume();
        stream.on("end", next);
        return;
      }
      const folderName = parts[0];
      const fileName = import_node_path.default.basename(normalized);
      const targetDir = import_node_path.default.join(destDir, folderName);
      import_node_fs.default.mkdirSync(targetDir, { recursive: true });
      const target = import_node_path.default.join(targetDir, fileName);
      const write = import_node_fs.default.createWriteStream(target);
      stream.pipe(write);
      write.on("finish", () => {
        if (!files.has(folderName)) files.set(folderName, /* @__PURE__ */ new Set());
        files.get(folderName).add(fileName);
        next();
      });
      write.on("error", reject);
      stream.on("error", reject);
    });
    extract.on("finish", resolve);
    extract.on("error", reject);
    import_node_fs.default.createReadStream(archivePath).pipe(import_node_zlib.default.createGunzip()).pipe(extract);
  });
  return { dir: destDir, files };
}
async function listArchiveFolders(archivePath) {
  const folders = /* @__PURE__ */ new Map();
  await new Promise((resolve, reject) => {
    const extract = tar.extract();
    extract.on("entry", (header, stream, next) => {
      const normalized = normalizeEntryName(header.name);
      const parts = normalized.split("/").filter(Boolean);
      if (header.type === "file" && parts.length >= 2) {
        folders.set(parts[0], (folders.get(parts[0]) || 0) + 1);
      }
      stream.resume();
      stream.on("end", next);
    });
    extract.on("finish", resolve);
    extract.on("error", reject);
    import_node_fs.default.createReadStream(archivePath).pipe(import_node_zlib.default.createGunzip()).pipe(extract);
  });
  return [...folders.entries()].map(([name, fileCount]) => ({ name, fileCount }));
}
function attachmentExists(index, folderName, fileName) {
  var _a;
  return ((_a = index.files.get(folderName)) == null ? void 0 : _a.has(fileName)) ?? false;
}
const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".txt": "text/plain",
  ".csv": "text/csv"
};
const BLOCKED_EXTS = [".exe", ".bat", ".sh", ".com", ".msi", ".dll"];
function isAllowedAttachment(fileName) {
  return !BLOCKED_EXTS.includes(import_node_path.default.extname(fileName).toLowerCase());
}
async function getStorageInfo(db) {
  var _a;
  const storagesRepo = db.getRepository("storages");
  let storage = await storagesRepo.findOne({ filter: { default: true } });
  if (!storage) {
    storage = await storagesRepo.findOne({ sort: ["id"] });
  }
  if (!storage) {
    throw new Error("\u672A\u627E\u5230\u53EF\u7528\u7684\u6587\u4EF6\u5B58\u50A8\uFF08storages\uFF09");
  }
  const storageJson = storage.toJSON();
  if (storageJson.type !== "local") {
    throw new Error(`\u9644\u4EF6\u5BFC\u5165\u6682\u4EC5\u652F\u6301 local \u7C7B\u578B\u5B58\u50A8\uFF0C\u5F53\u524D\u9ED8\u8BA4\u5B58\u50A8\u4E3A ${storageJson.type}`);
  }
  const storagePath = String(storageJson.path || "").replace(/^\/|\/$/g, "");
  const documentRoot = ((_a = storageJson.options) == null ? void 0 : _a.documentRoot) ? import_node_path.default.resolve(String(storageJson.options.documentRoot)) : (0, import_utils.storagePathJoin)("uploads");
  return { storagePath, documentRoot, storageId: storageJson.id };
}
async function createAttachmentRecord(db, filePath, fileName, storageInfo) {
  const { storagePath, documentRoot, storageId } = storageInfo || await getStorageInfo(db);
  const targetDir = import_node_path.default.join(documentRoot, storagePath);
  await import_promises.default.mkdir(targetDir, { recursive: true });
  const stat = await import_promises.default.stat(filePath);
  const extname = import_node_path.default.extname(fileName);
  const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname}`;
  await import_promises.default.copyFile(filePath, import_node_path.default.join(targetDir, storedName));
  const record = await db.getRepository("attachments").create({
    context: { state: { currentUser: {} } },
    values: {
      title: fileName.replace(extname, ""),
      filename: storedName,
      extname,
      path: storagePath,
      size: stat.size,
      mimetype: MIME_MAP[extname.toLowerCase()] || "application/octet-stream",
      storageId
    }
  });
  return record.toJSON();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  attachmentExists,
  createAttachmentRecord,
  extractAttachmentArchive,
  getStorageInfo,
  isAllowedAttachment,
  listArchiveFolders
});
