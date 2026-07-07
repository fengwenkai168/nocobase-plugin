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
var plugin_exports = {};
__export(plugin_exports, {
  PluginSjgl02Server: () => PluginSjgl02Server,
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);
var import_server = require("@nocobase/server");
var import_fs = __toESM(require("fs"));
var import_import = require("./actions/import");
var import_export = require("./actions/export");
var import_tasks = require("./actions/tasks");
var import_permissions = require("./actions/permissions");
var import_taskLogs = require("./actions/taskLogs");
var import_permission_service = require("./services/permission-service");
class PluginSjgl02Server extends import_server.Plugin {
  permissionService;
  async load() {
    this.permissionService = new import_permission_service.PermissionService(this.db);
    this.defineCustomResources();
    this.setupACL();
    setImmediate(() => {
      this.startupCleanup().catch(() => {
      });
    });
    try {
      const zGuard = await import("./workers/zombie-guard");
      zGuard.startSerialScheduler(this.db);
      this.app.on("beforeStop", () => zGuard.stopSerialScheduler());
    } catch (e) {
      console.error("[sjgl02] \u8C03\u5EA6\u5668\u52A0\u8F7D\u5931\u8D25:", (e == null ? void 0 : e.message) || e);
    }
  }
  /** 启动清理：残留任务、影子表、导出文件 */
  async startupCleanup() {
    try {
      const sequelize = this.db.sequelize;
      const tableExists = await (async () => {
        try {
          const [rows] = await sequelize.query(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'sjgl02_tasks' AND table_schema = current_schema()",
            { raw: true }
          );
          return rows.length > 0;
        } catch {
          return false;
        }
      })();
      if (tableExists) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1e3);
        try {
          await this.db.getRepository("sjgl02_tasks").update({
            filter: {
              status: { $in: ["processing", "pending"] },
              createdAt: { $lt: fiveMinAgo }
            },
            values: {
              status: "failed",
              errorMessage: "\u670D\u52A1\u5668\u91CD\u542F\uFF0C\u4EFB\u52A1\u4E2D\u65AD",
              completedAt: /* @__PURE__ */ new Date()
            }
          });
        } catch (err) {
          console.warn("startupCleanup sjgl02_tasks update failed:", err.message);
        }
        try {
          await this.db.getRepository("sjgl02_tasks").update({
            filter: {
              status: { $in: ["pending", "processing"] },
              tableName: { $is: null }
            },
            values: {
              status: "failed",
              errorMessage: "\u4EFB\u52A1\u6570\u636E\u5F02\u5E38\uFF1AtableName \u4E3A\u7A7A",
              completedAt: /* @__PURE__ */ new Date()
            }
          });
        } catch (err) {
          console.warn("startupCleanup invalid tasks cleanup failed:", err.message);
        }
      }
      const [shadowTables] = await sequelize.query(
        "SELECT tablename FROM pg_tables WHERE tablename LIKE '_sjgl02\\_import\\_%' ESCAPE '\\' AND schemaname = current_schema()",
        { raw: true }
      );
      for (const row of shadowTables) {
        try {
          const quoted = '"' + String(row.tablename).replace(/"/g, '""') + '"';
          await sequelize.query("DROP TABLE IF EXISTS " + quoted);
        } catch {
        }
      }
      const storageDir = process.env.STORAGE_DIR || "storage/uploads";
      const exportDir = storageDir + "/exports";
      if (import_fs.default.existsSync(exportDir)) {
        const files = import_fs.default.readdirSync(exportDir);
        for (const file of files) {
          if (file.startsWith("sjgl02_export_")) {
            try {
              import_fs.default.unlinkSync(exportDir + "/" + file);
            } catch {
            }
          }
        }
      }
    } catch {
    }
  }
  defineCustomResources() {
    this.app.resourceManager.define({
      name: "sjgl02Import",
      actions: {
        tableFields: import_import.getTableFields,
        uploadParse: import_import.uploadParse,
        preview: import_import.preview,
        execute: import_import.executeImport,
        autoMatch: import_import.autoMatch
      }
    });
    this.app.resourceManager.define({
      name: "sjgl02Export",
      actions: {
        tableFields: import_export.getExportTableFields,
        previewCount: import_export.previewCount,
        execute: import_export.executeExport,
        progress: import_export.getProgress,
        download: import_export.downloadExport
      }
    });
    this.app.resourceManager.define({
      name: "sjgl02Tasks",
      actions: {
        list: import_tasks.listTasks,
        detail: import_tasks.getTaskDetail,
        cancel: import_tasks.cancelTask,
        delete: import_tasks.deleteTask
      }
    });
    this.app.resourceManager.define({
      name: "sjgl02Permissions",
      actions: {
        userRoleList: import_permissions.getUserRoleList,
        tables: import_permissions.getTables,
        get: import_permissions.getPermissions,
        save: import_permissions.savePermissions,
        settings: import_permissions.getSettings,
        saveSettings: import_permissions.saveSettings
      }
    });
    this.app.resourceManager.define({
      name: "sjgl02TaskLogs",
      actions: {
        list: import_taskLogs.listTaskLogs
      }
    });
  }
  setupACL() {
    const acl = this.app.acl;
    acl.allow("sjgl02Import", "*", "loggedIn");
    acl.allow("sjgl02Export", "*", "loggedIn");
    acl.allow("sjgl02Tasks", "*", "loggedIn");
    acl.allow("sjgl02Permissions", "tables", "loggedIn");
    acl.allow("sjgl02Permissions", "get", "loggedIn");
    acl.allow("sjgl02Permissions", ["save", "saveSettings", "settings", "userRoleList"], "admin");
    acl.allow("sjgl02TaskLogs", "*", "loggedIn");
    acl.allow("sjgl02_table_permissions", "*", "admin");
    acl.allow("sjgl02_settings", "*", "admin");
    acl.allow("sjgl02_permission_logs", "*", "admin");
    acl.allow("sjgl02_task_logs", "*", "admin");
  }
  async install() {
    const settingRepo = this.db.getRepository("sjgl02_settings");
    const existing = await settingRepo.count();
    if (existing === 0) {
      await settingRepo.create({
        values: {
          taskViewScope: "own",
          maxFileSize: 50,
          batchSize: 1e3
        }
      });
    }
    const permRepo = this.db.getRepository("sjgl02_table_permissions");
    const permCount = await permRepo.count();
    if (permCount === 0 && this.db.hasCollection("roles")) {
      const roleRepo = this.db.getRepository("roles");
      const adminRole = await roleRepo.findOne({ filter: { name: "admin" } });
      const rootRole = await roleRepo.findOne({ filter: { name: "root" } });
      const roleIds = [];
      if (adminRole) roleIds.push(adminRole.name);
      if (rootRole) roleIds.push(rootRole.name);
      if (roleIds.length === 0) return;
      const tables = this.db.collections;
      const tablePermissions = [];
      for (const [name] of tables) {
        for (const roleId of roleIds) {
          tablePermissions.push({
            targetType: "role",
            targetId: roleId,
            targetName: roleId === "admin" ? "\u7BA1\u7406\u5458" : "\u8D85\u7EA7\u7BA1\u7406\u5458",
            tableName: name,
            canImport: true,
            canExport: true,
            importMode: ["insert", "update", "upsert"],
            uniqueFields: [],
            requiredFields: [],
            importFields: [],
            exportFields: []
          });
        }
      }
      if (tablePermissions.length > 0) {
        await Promise.all(tablePermissions.map((perm) => permRepo.create({ values: perm })));
      }
    }
  }
}
var plugin_default = PluginSjgl02Server;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PluginSjgl02Server
});
