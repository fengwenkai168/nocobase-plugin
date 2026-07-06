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
  getPermissions: () => getPermissions,
  getSettings: () => getSettings,
  getTables: () => getTables,
  getUserRoleList: () => getUserRoleList,
  savePermissions: () => savePermissions,
  saveSettings: () => saveSettings
});
module.exports = __toCommonJS(permissions_exports);
var import_permission_service = require("../services/permission-service");
async function getUserRoleList(ctx, next) {
  const userRepo = ctx.db.getRepository("users");
  const roleRepo = ctx.db.getRepository("roles");
  const users = await userRepo.find({ limit: 500, sort: ["id"], appends: ["roles"] });
  const roles = await roleRepo.find({ limit: 200, sort: ["name"] });
  ctx.body = {
    users: users.map((u) => ({
      id: String(u.id),
      nickname: u.nickname || u.username || u.email,
      type: "user",
      roles: (u.roles || []).map((r) => ({
        name: r.name,
        title: r.title && !/^\{\{/.test(r.title) ? r.title : r.name
      }))
    })),
    roles: roles.map((r) => ({
      id: r.name,
      name: r.name,
      title: r.title && !/^\{\{/.test(r.title) ? r.title : r.name,
      type: "role"
    }))
  };
  await next();
}
async function getTables(ctx, next) {
  var _a, _b;
  const collections = [];
  try {
    const dbCollections = ctx.db.collections;
    if (dbCollections instanceof Map) {
      for (const [name, coll] of dbCollections) {
        try {
          const isThrough = coll.isThrough ? coll.isThrough() : false;
          if (!isThrough) {
            collections.push({
              name,
              title: ((_a = coll.options) == null ? void 0 : _a.title) || name
            });
          }
        } catch {
          collections.push({
            name,
            title: ((_b = coll.options) == null ? void 0 : _b.title) || name
          });
        }
      }
    }
  } catch {
  }
  ctx.body = collections;
  await next();
}
async function getPermissions(ctx, next) {
  const { targetType, targetId } = ctx.action.params;
  if (!targetType || !targetId) {
    ctx.body = { custom: [], inherited: [] };
    await next();
    return;
  }
  const service = new import_permission_service.PermissionService(ctx.db);
  if (targetType === "role") {
    ctx.body = await service.getRolePermissions(String(targetId));
    await next();
    return;
  }
  if (targetType === "user") {
    ctx.body = await service.getUserPermissions(Number(targetId));
    await next();
    return;
  }
  ctx.body = { custom: [], inherited: [] };
  await next();
}
async function savePermissions(ctx, next) {
  var _a, _b, _c, _d, _e;
  const params = ctx.action.params.values || ctx.action.params;
  const { permissions } = params;
  const repo = ctx.db.getRepository("sjgl02_table_permissions");
  const logRepo = ctx.db.getRepository("sjgl02_permission_logs");
  const sequelize = ctx.db.sequelize;
  let targetType = "";
  let targetId = "";
  if (permissions && permissions.length > 0) {
    targetType = permissions[0].targetType || params.targetType || "";
    targetId = String(permissions[0].targetId || params.targetId || "");
  } else {
    targetType = params.targetType || ((_a = ctx.request.query) == null ? void 0 : _a.targetType) || "";
    targetId = params.targetId || ((_b = ctx.request.query) == null ? void 0 : _b.targetId) || "";
  }
  if (targetType === "role" && (targetId === "admin" || targetId === "root")) {
    ctx.body = { success: true };
    await next();
    return;
  }
  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    ctx.body = { success: true };
    await next();
    return;
  }
  const filter = { targetType, targetId: String(targetId) };
  const existingPerms = await repo.find({ filter });
  const operatorId = (_c = ctx.state.currentUser) == null ? void 0 : _c.id;
  const transaction = await sequelize.transaction();
  try {
    const submittedTableNames = new Set(permissions.map((p) => p.tableName));
    for (const existing of existingPerms) {
      if (!submittedTableNames.has(existing.tableName)) {
        await repo.destroy({ filterByTk: existing.id, transaction });
        try {
          await logRepo.create({
            values: {
              action: "delete",
              targetType: existing.targetType,
              targetId: existing.targetId,
              targetName: existing.targetName,
              tableName: existing.tableName,
              changes: { before: ((_d = existing.toJSON) == null ? void 0 : _d.call(existing)) || existing },
              operatorId,
              createdAt: /* @__PURE__ */ new Date()
            },
            transaction
          });
        } catch {
        }
      }
    }
    for (const perm of permissions) {
      if (perm.canImport && (!perm.importMode || !Array.isArray(perm.importMode) || perm.importMode.length === 0)) {
        perm.importMode = ["insert", "update", "upsert"];
      }
      const existing = existingPerms.find((e) => e.tableName === perm.tableName);
      if (existing) {
        await repo.update({
          filterByTk: existing.id,
          values: { ...perm, targetType, targetId: String(targetId) },
          transaction
        });
        try {
          await logRepo.create({
            values: {
              action: "update",
              targetType,
              targetId: String(targetId),
              targetName: perm.targetName || existing.targetName,
              tableName: perm.tableName,
              changes: { before: ((_e = existing.toJSON) == null ? void 0 : _e.call(existing)) || existing, after: perm },
              operatorId,
              createdAt: /* @__PURE__ */ new Date()
            },
            transaction
          });
        } catch {
        }
      } else {
        await repo.create({ values: { ...perm, targetType, targetId: String(targetId), operatorId }, transaction });
        try {
          await logRepo.create({
            values: {
              action: "create",
              targetType,
              targetId: String(targetId),
              targetName: perm.targetName,
              tableName: perm.tableName,
              changes: { after: perm },
              operatorId,
              createdAt: /* @__PURE__ */ new Date()
            },
            transaction
          });
        } catch {
        }
      }
    }
    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
    }
    throw err;
  }
  ctx.body = { success: true };
  await next();
}
async function getSettings(ctx, next) {
  var _a;
  const repo = ctx.db.getRepository("sjgl02_settings");
  const userId = ctx.action.params.userId || ((_a = ctx.state.currentUser) == null ? void 0 : _a.id);
  let settings = null;
  if (userId) settings = await repo.findOne({ filter: { userId } });
  if (!settings) {
    settings = await repo.findOne({ filter: { userId: { $is: null } } });
  }
  ctx.body = settings || { taskViewScope: "own", maxFileSize: 50, batchSize: 1e3 };
  await next();
}
async function saveSettings(ctx, next) {
  var _a;
  const values = ctx.action.params.values || ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_settings");
  const userId = values.userId || ((_a = ctx.state.currentUser) == null ? void 0 : _a.id);
  let settings = null;
  if (userId) settings = await repo.findOne({ filter: { userId } });
  if (settings) {
    await repo.update({ filterByTk: settings.id, values: { ...values, userId } });
  } else {
    await repo.create({ values: { ...values, userId: userId || null } });
  }
  ctx.body = { success: true };
  await next();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getPermissions,
  getSettings,
  getTables,
  getUserRoleList,
  savePermissions,
  saveSettings
});
