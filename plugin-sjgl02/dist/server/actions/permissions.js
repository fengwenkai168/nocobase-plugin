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
var permissions_exports = {};
__export(permissions_exports, {
  registerPermissionActions: () => registerPermissionActions,
  registerPermissionLogHooks: () => registerPermissionLogHooks
});
module.exports = __toCommonJS(permissions_exports);
var import_utils = require("./utils");
var import_permission = require("../services/permission");
function arr(value) {
  return Array.isArray(value) ? value : [];
}
function summarize(values) {
  const parts = [];
  parts.push(`\u5BFC\u5165=${values.canImport ? "\u662F" : "\u5426"}`);
  parts.push(`\u5BFC\u51FA=${values.canExport ? "\u662F" : "\u5426"}`);
  if (arr(values.importModes).length) parts.push(`\u6A21\u5F0F=${arr(values.importModes).join("/")}`);
  if (arr(values.uniqueFields).length) parts.push(`\u552F\u4E00\u503C=${arr(values.uniqueFields).join(",")}`);
  if (arr(values.requiredFields).length) parts.push(`\u5FC5\u586B=${arr(values.requiredFields).join(",")}`);
  if (arr(values.importFields).length) parts.push(`\u53EF\u5BFC\u5165=${arr(values.importFields).length}\u5B57\u6BB5`);
  if (arr(values.exportFields).length) parts.push(`\u53EF\u5BFC\u51FA=${arr(values.exportFields).length}\u5B57\u6BB5`);
  return parts.join(" ");
}
function diffSummary(before, after) {
  const changes = [];
  if (before.canImport !== after.canImport) changes.push(`canImport ${before.canImport ? "\u662F" : "\u5426"}->${after.canImport ? "\u662F" : "\u5426"}`);
  if (before.canExport !== after.canExport) changes.push(`canExport ${before.canExport ? "\u662F" : "\u5426"}->${after.canExport ? "\u662F" : "\u5426"}`);
  const fields = [
    ["importModes", "\u5BFC\u5165\u6A21\u5F0F"],
    ["uniqueFields", "\u552F\u4E00\u503C\u5B57\u6BB5"],
    ["requiredFields", "\u5FC5\u586B\u5B57\u6BB5"],
    ["importFields", "\u53EF\u5BFC\u5165\u5B57\u6BB5"],
    ["exportFields", "\u53EF\u5BFC\u51FA\u5B57\u6BB5"],
    ["exportFilter", "\u5BFC\u51FA\u7B5B\u9009"]
  ];
  const changedNames = [];
  for (const [key, label] of fields) {
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
      changedNames.push(label);
    }
  }
  if (changes.length) return `\u5207\u6362\u5F00\u5173:${changes.join(" ")}`;
  if (changedNames.length) return `\u4FEE\u6539\u6743\u9650:${changedNames.join("+")}\u53D8\u66F4`;
  return "\u4FEE\u6539\u6743\u9650:\u914D\u7F6E\u53D8\u66F4";
}
function registerPermissionLogHooks(plugin) {
  const db = plugin.db;
  const logsRepo = () => db.getRepository("sjgl02PermissionLogs");
  const beforeSnapshots = /* @__PURE__ */ new Map();
  db.on("sjgl02Permissions.beforeUpdate", async (model) => {
    const json = model.toJSON();
    const previous = model._previousDataValues || (typeof model.previous === "function" ? model.previous() : json);
    beforeSnapshots.set(json.id ?? model, { ...previous });
  });
  const writeLog = async (entry, operatorId) => {
    try {
      await logsRepo().create({ values: { ...entry, createdById: operatorId } });
    } catch (error) {
      plugin.app.logger.error("[sjgl02] \u6743\u9650\u65E5\u5FD7\u5199\u5165\u5931\u8D25", error);
    }
  };
  db.on("sjgl02Permissions.afterCreate", async (model, options) => {
    var _a, _b;
    const values = model.toJSON();
    await writeLog(
      {
        action: "create",
        targetType: values.targetType,
        targetId: values.targetId,
        targetName: values.targetName,
        collectionName: values.collectionName,
        collectionTitle: values.collectionTitle,
        permissionId: values.id,
        beforeValue: null,
        afterValue: values,
        summary: `\u65B0\u589E\u6743\u9650:${summarize(values)}`
      },
      (_b = (_a = options == null ? void 0 : options.context) == null ? void 0 : _a.state) == null ? void 0 : _b.currentUserId
    );
  });
  db.on("sjgl02Permissions.afterUpdate", async (model, options) => {
    var _a, _b;
    const after = model.toJSON();
    const before = beforeSnapshots.get(after.id) || after;
    beforeSnapshots.delete(after.id);
    const action = before.canImport !== after.canImport || before.canExport !== after.canExport ? "toggle" : "update";
    await writeLog(
      {
        action,
        targetType: after.targetType,
        targetId: after.targetId,
        targetName: after.targetName,
        collectionName: after.collectionName,
        collectionTitle: after.collectionTitle,
        permissionId: after.id,
        beforeValue: before,
        afterValue: after,
        summary: diffSummary(before, after)
      },
      (_b = (_a = options == null ? void 0 : options.context) == null ? void 0 : _a.state) == null ? void 0 : _b.currentUserId
    );
  });
  db.on("sjgl02Permissions.afterDestroy", async (model, options) => {
    var _a, _b;
    const values = model.toJSON();
    await writeLog(
      {
        action: "delete",
        targetType: values.targetType,
        targetId: values.targetId,
        targetName: values.targetName,
        collectionName: values.collectionName,
        collectionTitle: values.collectionTitle,
        permissionId: values.id,
        beforeValue: values,
        afterValue: null,
        summary: `\u79FB\u9664\u6743\u9650:${summarize(values)}`
      },
      (_b = (_a = options == null ? void 0 : options.context) == null ? void 0 : _a.state) == null ? void 0 : _b.currentUserId
    );
  });
}
function cleanTitle(title, fallback) {
  const text = String(title || "");
  const match = text.match(/^\{\{t\("(.+?)"\)\}\}$/);
  return match ? match[1] : text || fallback;
}
function registerPermissionActions(plugin) {
  const permissionService = new import_permission.PermissionService(plugin);
  plugin.app.resourcer.use(
    async (ctx, next) => {
      const { resourceName, actionName } = ctx.action;
      if (resourceName === "sjgl02Permissions" && ["create", "update", "destroy"].includes(actionName) || resourceName === "sjgl02PermissionLogs" && !["list", "get"].includes(actionName)) {
        const roleNames = await permissionService.getUserRoleNames((0, import_utils.currentUserId)(ctx));
        if (!permissionService.isAdmin(roleNames)) {
          ctx.throw(403, "\u4EC5 admin/root \u53EF\u7BA1\u7406\u6743\u9650\u914D\u7F6E");
        }
      }
      await next();
    },
    { tag: "sjgl02PermGuard", after: "auth" }
  );
  return {
    "permTargets": async (ctx, next) => {
      const users = await plugin.db.getRepository("users").find({
        fields: ["id", "nickname", "username"],
        appends: ["roles"],
        sort: ["id"],
        limit: 200
      });
      const roles = await plugin.db.getRepository("roles").find({ sort: ["name"] });
      ctx.body = {
        users: users.map((u) => ({
          id: u.get("id"),
          name: u.get("nickname") || u.get("username"),
          roles: (u.get("roles") || []).map((r) => ({ name: r.name, title: r.title }))
        })),
        roles: roles.map((r) => ({ name: r.get("name"), title: r.get("title") || r.get("name") }))
      };
      await next();
    },
    "permList": async (ctx, next) => {
      const params = { ...ctx.action.params || {}, ...ctx.action.params.values || {} };
      const { targetType, targetId } = params;
      if (!targetType || !targetId) {
        ctx.throw(400, "\u7F3A\u5C11\u53C2\u6570 targetType/targetId");
      }
      const repo = plugin.db.getRepository("sjgl02Permissions");
      const own = await repo.find({ filter: { targetType, targetId: String(targetId) }, sort: ["sort", "id"] });
      const result = {
        own: own.map((m) => m.toJSON()),
        inherited: []
      };
      if (targetType === "user") {
        const roleNames = await permissionService.getUserRoleNames(Number(targetId));
        const groups = [];
        for (const roleName of roleNames) {
          const isAdminRole = ["admin", "root"].includes(roleName);
          const role = await plugin.db.getRepository("roles").findOne({ filter: { name: roleName } });
          const items = isAdminRole ? [] : (await repo.find({ filter: { targetType: "role", targetId: roleName }, sort: ["sort", "id"] })).map((m) => m.toJSON());
          groups.push({ roleName, roleTitle: cleanTitle(role == null ? void 0 : role.get("title"), roleName), items, isAdmin: isAdminRole });
        }
        result.inherited = groups;
      }
      ctx.body = result;
      await next();
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerPermissionActions,
  registerPermissionLogHooks
});
