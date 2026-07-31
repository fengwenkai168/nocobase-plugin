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
var permission_exports = {};
__export(permission_exports, {
  ADMIN_ROLES: () => ADMIN_ROLES,
  PermissionService: () => PermissionService
});
module.exports = __toCommonJS(permission_exports);
const ADMIN_ROLES = ["admin", "root"];
class PermissionService {
  constructor(plugin) {
    this.plugin = plugin;
  }
  get repo() {
    return this.plugin.db.getRepository("sjgl02Permissions");
  }
  async getUserRoleNames(userId) {
    if (!userId) return [];
    const user = await this.plugin.db.getRepository("users").findOne({
      filter: { id: userId },
      appends: ["roles"]
    });
    const roles = (user == null ? void 0 : user.get("roles")) || [];
    return roles.map((r) => r.name);
  }
  isAdmin(roleNames) {
    return roleNames.some((r) => ADMIN_ROLES.includes(r));
  }
  toConfig(model) {
    const arr = (v) => Array.isArray(v) ? v : [];
    return {
      id: model.id,
      targetType: model.targetType,
      targetId: String(model.targetId ?? ""),
      targetName: String(model.targetName ?? ""),
      canImport: !!model.canImport,
      canExport: !!model.canExport,
      importModes: arr(model.importModes),
      uniqueFields: arr(model.uniqueFields),
      requiredFields: arr(model.requiredFields),
      importFields: arr(model.importFields),
      exportFields: arr(model.exportFields),
      exportFilter: model.exportFilter ?? null
    };
  }
  adminConfig(roleName) {
    return {
      id: null,
      targetType: "role",
      targetId: roleName,
      targetName: roleName === "root" ? "\u8D85\u7EA7\u7BA1\u7406\u5458(root)" : "\u7BA1\u7406\u5458(admin)",
      canImport: true,
      canExport: true,
      importModes: ["insert", "update", "upsert"],
      uniqueFields: [],
      requiredFields: [],
      importFields: [],
      exportFields: [],
      exportFilter: null
    };
  }
  async listImportPermissions(userId, collectionName) {
    const roleNames = await this.getUserRoleNames(userId);
    if (this.isAdmin(roleNames)) {
      const all = await this.listAllPermissions(collectionName, "import");
      return [...all, this.adminConfig(ADMIN_ROLES.find((r) => roleNames.includes(r)))];
    }
    return this.listConfiguredPermissions(userId, roleNames, collectionName, "import");
  }
  async listExportPermissions(userId, collectionName) {
    const roleNames = await this.getUserRoleNames(userId);
    if (this.isAdmin(roleNames)) {
      const all = await this.listAllPermissions(collectionName, "export");
      return [...all, this.adminConfig(ADMIN_ROLES.find((r) => roleNames.includes(r)))];
    }
    return this.listConfiguredPermissions(userId, roleNames, collectionName, "export");
  }
  // 供「复用方案排序」使用：返回指定表所有可导出的方案及其字段顺序（仅字段名排序，无数据），任何登录用户可查
  async listExportSchemes(collectionName) {
    const models = await this.repo.find({
      filter: { canExport: true, collectionName },
      sort: ["sort", "id"],
      fields: ["id", "targetType", "targetId", "targetName", "exportFields"]
    });
    return models.map((m) => ({
      id: m.get("id"),
      targetType: m.get("targetType"),
      targetId: String(m.get("targetId") ?? ""),
      targetName: String(m.get("targetName") ?? ""),
      exportFields: Array.isArray(m.get("exportFields")) ? m.get("exportFields") : []
    }));
  }
  async listConfiguredPermissions(userId, roleNames, collectionName, kind) {
    const flagField = kind === "import" ? "canImport" : "canExport";
    const filter = {
      [flagField]: true,
      $or: [
        { targetType: "user", targetId: String(userId) },
        ...roleNames.length ? [{ targetType: "role", targetId: { $in: roleNames } }] : []
      ]
    };
    if (collectionName) {
      filter.collectionName = collectionName;
    }
    const models = await this.repo.find({ filter, sort: ["sort", "id"] });
    return models.map((m) => this.toConfig(m.toJSON()));
  }
  async listAllPermissions(collectionName, kind) {
    const flagField = kind === "import" ? "canImport" : "canExport";
    const filter = { [flagField]: true };
    if (collectionName) {
      filter.collectionName = collectionName;
    }
    const models = await this.repo.find({ filter, sort: ["sort", "id"] });
    return models.map((m) => this.toConfig(m.toJSON()));
  }
  async getPermissionForExecution(userId, permissionId) {
    const roleNames = await this.getUserRoleNames(userId);
    if (permissionId === null || permissionId === void 0) {
      if (!this.isAdmin(roleNames)) {
        throw new Error("\u4EC5 admin/root \u53EF\u4E0D\u6307\u5B9A\u6743\u9650\u914D\u7F6E\u6267\u884C");
      }
      return { config: this.adminConfig(ADMIN_ROLES.find((r) => roleNames.includes(r))), roleNames };
    }
    const model = await this.repo.findOne({ filter: { id: permissionId } });
    if (!model) {
      throw new Error(`\u6743\u9650\u914D\u7F6E #${permissionId} \u4E0D\u5B58\u5728`);
    }
    const config = this.toConfig(model.toJSON());
    if (!this.isAdmin(roleNames)) {
      const owned = config.targetType === "user" && config.targetId === String(userId) || config.targetType === "role" && roleNames.includes(config.targetId);
      if (!owned) {
        throw new Error("\u65E0\u6743\u4F7F\u7528\u8BE5\u6743\u9650\u914D\u7F6E");
      }
    }
    return { config, roleNames };
  }
  assertImportParams(config, params) {
    if (!config.canImport) {
      throw new Error("\u8BE5\u6743\u9650\u914D\u7F6E\u4E0D\u5141\u8BB8\u5BFC\u5165");
    }
    if (config.importModes.length && !config.importModes.includes(params.mode)) {
      throw new Error(`\u5BFC\u5165\u6A21\u5F0F ${params.mode} \u4E0D\u5728\u6743\u9650\u5141\u8BB8\u8303\u56F4\u5185\uFF08${config.importModes.join("/")}\uFF09`);
    }
    if (config.importFields.length) {
      const denied = params.mappingFields.filter((f) => !config.importFields.includes(f));
      if (denied.length) {
        throw new Error(`\u5B57\u6BB5 ${denied.join(", ")} \u4E0D\u5728\u53EF\u5BFC\u5165\u5B57\u6BB5\u767D\u540D\u5355\u5185`);
      }
    }
    if (config.uniqueFields.length) {
      const same = config.uniqueFields.length === params.uniqueFields.length && config.uniqueFields.every((f) => params.uniqueFields.includes(f));
      if (!same) {
        throw new Error("\u552F\u4E00\u503C\u5B57\u6BB5\u7531\u6743\u9650\u914D\u7F6E\u9501\u5B9A\uFF0C\u5FC5\u987B\u4E3A\uFF1A" + config.uniqueFields.join(", "));
      }
    }
    if ((params.mode === "update" || params.mode === "upsert") && params.uniqueFields.length === 0) {
      throw new Error("update/upsert \u6A21\u5F0F\u5FC5\u987B\u81F3\u5C11\u9009\u62E9 1 \u4E2A\u552F\u4E00\u503C\u5B57\u6BB5");
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADMIN_ROLES,
  PermissionService
});
