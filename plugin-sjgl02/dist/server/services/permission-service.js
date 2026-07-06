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
var permission_service_exports = {};
__export(permission_service_exports, {
  PermissionService: () => PermissionService
});
module.exports = __toCommonJS(permission_service_exports);
class PermissionService {
  constructor(db) {
    this.db = db;
  }
  async getUserRoleNames(userId) {
    try {
      const repo = this.db.getRepository("rolesUsers");
      const rows = await repo.find({ filter: { userId: Number(userId) } });
      return [...new Set((rows || []).map((r) => String(r.roleName || "")).filter(Boolean))];
    } catch {
      return [];
    }
  }
  async findPermission(targetType, targetId, tableName) {
    try {
      const [rows] = await this.db.sequelize.query(
        'SELECT * FROM "sjgl02_table_permissions" WHERE "targetType" = $1 AND "targetId" = $2 AND "tableName" = $3',
        { bind: [targetType, targetId, tableName], raw: true }
      );
      return rows[0] || null;
    } catch {
      return null;
    }
  }
  async findPermissionsByTarget(targetType, targetId) {
    try {
      const [rows] = await this.db.sequelize.query(
        'SELECT * FROM "sjgl02_table_permissions" WHERE "targetType" = $1 AND "targetId" = $2 ORDER BY "id"',
        { bind: [targetType, targetId], raw: true }
      );
      return rows || [];
    } catch {
      return [];
    }
  }
  async findPermissionsByRoles(roleNames) {
    if (roleNames.length === 0) return [];
    try {
      const placeholders = roleNames.map((_, i) => "$" + (i + 1)).join(", ");
      const [rows] = await this.db.sequelize.query(
        `SELECT * FROM "sjgl02_table_permissions" WHERE "targetType" = 'role' AND "targetId" IN (` + placeholders + ') ORDER BY "id"',
        { bind: roleNames, raw: true }
      );
      return rows || [];
    } catch {
      return [];
    }
  }
  fullPermission() {
    return {
      canImport: true,
      canExport: true,
      importMode: ["insert", "update", "upsert"],
      importFields: [],
      exportFields: [],
      uniqueFields: [],
      requiredFields: []
    };
  }
  permissionFromRecord(record) {
    return {
      canImport: (record == null ? void 0 : record.canImport) ?? false,
      canExport: (record == null ? void 0 : record.canExport) ?? false,
      importMode: Array.isArray(record == null ? void 0 : record.importMode) ? record.importMode : [(record == null ? void 0 : record.importMode) || "insert"],
      importFields: (record == null ? void 0 : record.importFields) || [],
      exportFields: (record == null ? void 0 : record.exportFields) || [],
      uniqueFields: (record == null ? void 0 : record.uniqueFields) || [],
      requiredFields: (record == null ? void 0 : record.requiredFields) || []
    };
  }
  mergePermissions(perms) {
    if (perms.length === 0) {
      return {
        canImport: false,
        canExport: false,
        importMode: [],
        importFields: [],
        exportFields: [],
        uniqueFields: [],
        requiredFields: []
      };
    }
    const allowed = perms.filter((p) => p.canImport === true || p.canExport === true);
    if (allowed.length === 0) {
      return {
        canImport: false,
        canExport: false,
        importMode: [],
        importFields: [],
        exportFields: [],
        uniqueFields: [],
        requiredFields: []
      };
    }
    const canImport = allowed.some((p) => p.canImport === true);
    const canExport = allowed.some((p) => p.canExport === true);
    const importMode = [
      ...new Set(
        allowed.flatMap((p) => Array.isArray(p.importMode) ? p.importMode : [p.importMode].filter(Boolean))
      )
    ];
    const hasFullImport = allowed.some((p) => !p.importFields || p.importFields.length === 0);
    const importFields = hasFullImport ? [] : [...new Set(allowed.flatMap((p) => p.importFields || []))];
    const hasFullExport = allowed.some((p) => !p.exportFields || p.exportFields.length === 0);
    const exportFields = hasFullExport ? [] : [...new Set(allowed.flatMap((p) => p.exportFields || []))];
    const uniqueFields = [...new Set(allowed.flatMap((p) => p.uniqueFields || []))];
    const requiredFields = [...new Set(allowed.flatMap((p) => p.requiredFields || []))];
    return {
      canImport,
      canExport,
      importMode,
      importFields,
      exportFields,
      uniqueFields,
      requiredFields
    };
  }
  async checkPermission(currentUserId, tableName, actionType, permSource) {
    const roleNames = await this.getUserRoleNames(currentUserId);
    const isAdmin = roleNames.includes("admin") || roleNames.includes("root");
    if (isAdmin) {
      if (permSource && permSource.id) {
        if (permSource.type === "admin") {
          return this.fullPermission();
        }
        if (permSource.type === "user") {
          const targetPerms = await this.getUserPermissions(Number(permSource.id));
          const allPerms = [...targetPerms.custom || [], ...targetPerms.inherited || []];
          const perm = allPerms.find((p) => p.tableName === tableName);
          if (!perm || !perm[actionType === "import" ? "canImport" : "canExport"]) {
            throw new Error(
              "\u6240\u9009\u6743\u9650\u65B9\u6848\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C" + tableName + "\u300D\u7684" + (actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") + "\u6743\u9650"
            );
          }
          return this.permissionFromRecord(perm);
        }
        if (permSource.type === "role" && (permSource.id === "admin" || permSource.id === "root")) {
          return this.fullPermission();
        }
        const targetPerm = await this.findPermission(permSource.type, String(permSource.id), tableName);
        if (!targetPerm) {
          throw new Error(
            "\u6240\u9009\u6743\u9650\u65B9\u6848\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C" + tableName + "\u300D\u7684" + (actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") + "\u6743\u9650"
          );
        }
        const fieldName = actionType === "import" ? "canImport" : "canExport";
        if (!targetPerm[fieldName]) {
          throw new Error(
            "\u6240\u9009\u6743\u9650\u65B9\u6848\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C" + tableName + "\u300D\u7684" + (actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") + "\u6743\u9650"
          );
        }
        return this.permissionFromRecord(targetPerm);
      }
      return this.fullPermission();
    }
    if (permSource && permSource.id) {
      if (permSource.type === "user" && String(permSource.id) === String(currentUserId)) {
      } else {
        const targetPerm = await this.findPermission(
          permSource.type,
          permSource.type === "user" ? String(permSource.id) : permSource.id,
          tableName
        );
        if (!targetPerm) {
          throw new Error(
            "\u6240\u9009\u6743\u9650\u65B9\u6848\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C" + tableName + "\u300D\u7684" + (actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") + "\u6743\u9650"
          );
        }
        const fieldName = actionType === "import" ? "canImport" : "canExport";
        if (!targetPerm[fieldName]) {
          throw new Error(
            "\u6240\u9009\u6743\u9650\u65B9\u6848\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C" + tableName + "\u300D\u7684" + (actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") + "\u6743\u9650"
          );
        }
        return this.permissionFromRecord(targetPerm);
      }
    }
    const userPerm = await this.findPermission("user", String(currentUserId), tableName);
    if (userPerm) {
      const fieldName = actionType === "import" ? "canImport" : "canExport";
      if (!userPerm[fieldName]) {
        throw new Error(
          "\u60A8\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C" + tableName + "\u300D\u7684" + (actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") + "\u6743\u9650\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458"
        );
      }
      return this.permissionFromRecord(userPerm);
    }
    if (roleNames.length > 0) {
      const rolePerms = await this.findPermissionsByRoles(roleNames);
      const filtered = rolePerms.filter((p) => p.tableName === tableName);
      const merged = this.mergePermissions(filtered);
      const fieldName = actionType === "import" ? "canImport" : "canExport";
      if (!merged[fieldName]) {
        throw new Error(
          "\u60A8\u7684\u89D2\u8272\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C" + tableName + "\u300D\u7684" + (actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") + "\u6743\u9650\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458"
        );
      }
      return merged;
    }
    throw new Error(
      "\u60A8\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C" + tableName + "\u300D\u7684" + (actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") + "\u6743\u9650\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458"
    );
  }
  async getAdminAllPermissions() {
    const tables = this.getAllTableNames();
    return tables.map((name) => ({
      targetType: "role",
      targetId: "admin",
      targetName: "\u7BA1\u7406\u5458",
      tableName: name,
      canImport: true,
      canExport: true,
      importMode: ["insert", "update", "upsert"],
      uniqueFields: [],
      requiredFields: [],
      importFields: [],
      exportFields: [],
      _inherited: true,
      _systemManaged: true
    }));
  }
  async getRolePermissions(roleName) {
    if (roleName === "admin" || roleName === "root") {
      const perms2 = await this.getAdminAllPermissions();
      return {
        custom: [],
        inherited: perms2.map((p) => ({
          ...p,
          targetId: roleName,
          targetName: roleName === "root" ? "\u8D85\u7EA7\u7BA1\u7406\u5458" : "\u7BA1\u7406\u5458"
        }))
      };
    }
    const perms = await this.findPermissionsByTarget("role", roleName);
    return { custom: perms, inherited: [] };
  }
  async getUserPermissions(userId) {
    const roleNames = await this.getUserRoleNames(userId);
    const uid = String(userId);
    if (roleNames.includes("admin") || roleNames.includes("root")) {
      const tables = this.getAllTableNames();
      const roleName = roleNames.includes("root") ? "root" : "admin";
      const inherited2 = tables.map((name) => ({
        targetType: "role",
        targetId: roleName,
        targetName: roleName === "root" ? "\u8D85\u7EA7\u7BA1\u7406\u5458" : "\u7BA1\u7406\u5458",
        tableName: name,
        canImport: true,
        canExport: true,
        importMode: ["insert", "update", "upsert"],
        uniqueFields: [],
        requiredFields: [],
        importFields: [],
        exportFields: [],
        _inherited: true,
        _systemManaged: true
      }));
      const custom2 = await this.findPermissionsByTarget("user", uid);
      return { custom: custom2, inherited: inherited2 };
    }
    let inherited = [];
    if (roleNames.length > 0) {
      const rolePerms = await this.findPermissionsByRoles(roleNames);
      inherited = rolePerms.map((p) => ({ ...p, _inherited: true }));
    }
    const custom = await this.findPermissionsByTarget("user", uid);
    return { custom, inherited };
  }
  getAllTableNames() {
    const names = [];
    try {
      const dbCollections = this.db.collections;
      if (dbCollections instanceof Map) {
        for (const [name, coll] of dbCollections) {
          try {
            const isThrough = coll.isThrough ? coll.isThrough() : false;
            if (!isThrough) names.push(name);
          } catch {
            names.push(name);
          }
        }
      }
    } catch {
    }
    return names;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PermissionService
});
