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
var plugin_exports = {};
__export(plugin_exports, {
  PluginSjgl02Server: () => PluginSjgl02Server,
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);
var import_server = require("@nocobase/server");
var import_import = require("./actions/import");
var import_export = require("./actions/export");
var import_tasks = require("./actions/tasks");
var import_permissions = require("./actions/permissions");
class PluginSjgl02Server extends import_server.Plugin {
  async load() {
    this.defineCustomResources();
    this.setupACL();
  }
  defineCustomResources() {
    this.app.resourceManager.define({
      name: "sjgl02Import",
      actions: {
        tableFields: import_import.getTableFields,
        uploadParse: import_import.uploadParse,
        preview: import_import.preview,
        execute: import_import.executeImport
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
        cancel: import_tasks.cancelTask
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
  }
  setupACL() {
    const acl = this.app.acl;
    acl.allow("sjgl02Import", "*", "loggedIn");
    acl.allow("sjgl02Export", "*", "loggedIn");
    acl.allow("sjgl02Tasks", "*", "loggedIn");
    acl.allow("sjgl02Permissions", "*", "loggedIn");
    acl.allow("sjgl02_tasks", "*", "loggedIn");
    acl.allow("sjgl02_table_permissions", "*", "loggedIn");
    acl.allow("sjgl02_settings", "*", "loggedIn");
  }
  async install() {
    const settingRepo = this.db.getRepository("sjgl02_settings");
    const existing = await settingRepo.count();
    if (existing === 0) {
      await settingRepo.create({
        values: {
          taskViewScope: "all",
          maxFileSize: 50,
          batchSize: 1e3
        }
      });
    }
    const permRepo = this.db.getRepository("sjgl02_table_permissions");
    const permCount = await permRepo.count();
    if (permCount === 0) {
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
        if (name.startsWith("sjgl02_")) continue;
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
