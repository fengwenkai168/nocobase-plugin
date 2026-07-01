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
  const repo = ctx.db.getRepository("sjgl02_table_permissions");
  if (targetType === "user") {
    let rolePerms = [];
    try {
      const userRepo = ctx.db.getRepository("users");
      const user = await userRepo.findOne({ filterByTk: Number(targetId), appends: ["roles"] });
      const roleNames = ((user == null ? void 0 : user.roles) || []).map((r) => r.name);
      if (roleNames.length > 0) {
        rolePerms = (await repo.find({ filter: { targetType: "role", targetId: { $in: roleNames } } })).map((p) => ({ ...p.toJSON ? p.toJSON() : p, _inherited: true }));
      }
    } catch {
    }
    const userPerms = (await repo.find({ filter: { targetType: "user", targetId: String(targetId) } })).map((p) => ({ ...p.toJSON ? p.toJSON() : p, _inherited: false }));
    ctx.body = { custom: userPerms, inherited: rolePerms };
    await next();
    return;
  }
  if (targetType === "role") {
    try {
      const roleRepo = ctx.db.getRepository("roles");
      const role = await roleRepo.findOne({ filter: { name: targetId } });
      if ((role == null ? void 0 : role.name) === "admin" || (role == null ? void 0 : role.name) === "root") {
        const existing = await repo.find({ filter: { targetType: "role", targetId: String(targetId) } });
        const existingNames = new Set(existing.map((p) => p.tableName));
        const tables = ctx.db.collections;
        const toCreate = [];
        for (const [name] of tables) {
          if (!existingNames.has(name)) {
            toCreate.push({
              targetType: "role",
              targetId: String(targetId),
              targetName: (role == null ? void 0 : role.name) === "root" ? "\u8D85\u7EA7\u7BA1\u7406\u5458" : "\u7BA1\u7406\u5458",
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
        if (toCreate.length > 0) {
          for (const item of toCreate) {
            await repo.create({ values: item });
          }
        }
      }
    } catch {
    }
  }
  const permissions = (await repo.find({ filter: { targetType, targetId: String(targetId) } })).map((p) => ({ ...p.toJSON ? p.toJSON() : p }));
  if (targetType === "role") {
    try {
      const r = await ctx.db.getRepository("roles").findOne({ filter: { name: targetId } });
      if ((r == null ? void 0 : r.name) === "admin" || (r == null ? void 0 : r.name) === "root") {
        permissions.forEach((p) => {
          p._inherited = true;
          p._systemManaged = true;
        });
      }
    } catch {
    }
  }
  ctx.body = { custom: permissions, inherited: [] };
  await next();
}
async function savePermissions(ctx, next) {
  var _a, _b, _c;
  const params = ctx.action.params.values || ctx.action.params;
  const { permissions } = params;
  if (!permissions || !Array.isArray(permissions)) {
    ctx.body = { success: true };
    await next();
    return;
  }
  const repo = ctx.db.getRepository("sjgl02_table_permissions");
  if (permissions.length === 0) {
    ctx.body = { success: true };
    await next();
    return;
  }
  const firstPerm = permissions[0];
  if (!firstPerm.targetType || !firstPerm.targetId) {
    ctx.body = { success: true };
    await next();
    return;
  }
  const filter = { targetType: firstPerm.targetType, targetId: String(firstPerm.targetId) };
  const existingPerms = await repo.find({ filter });
  const logRepo = ctx.db.getRepository("sjgl02_permission_logs");
  const operatorId = (_a = ctx.state.currentUser) == null ? void 0 : _a.id;
  const submittedTableNames = new Set(permissions.map((p) => p.tableName));
  for (const existing of existingPerms) {
    if (!submittedTableNames.has(existing.tableName)) {
      await repo.destroy({ filterByTk: existing.id });
      try {
        await logRepo.create({ values: {
          action: "delete",
          targetType: existing.targetType,
          targetId: existing.targetId,
          targetName: existing.targetName,
          tableName: existing.tableName,
          changes: { before: ((_b = existing.toJSON) == null ? void 0 : _b.call(existing)) || existing },
          operatorId,
          createdAt: /* @__PURE__ */ new Date()
        } });
      } catch {
      }
    }
  }
  for (const perm of permissions) {
    if (perm.canImport && (!perm.importMode || !Array.isArray(perm.importMode) || perm.importMode.length === 0)) {
      perm.importMode = ["insert", "update", "upsert"];
    }
    const existing = existingPerms.find((e) => e.tableName === perm.tableName);
    if (perm.id && existing) {
      await repo.update({ filterByTk: perm.id, values: perm });
      try {
        await logRepo.create({ values: {
          action: "update",
          targetType: perm.targetType,
          targetId: perm.targetId,
          targetName: perm.targetName,
          tableName: perm.tableName,
          changes: { before: ((_c = existing.toJSON) == null ? void 0 : _c.call(existing)) || existing, after: perm },
          operatorId,
          createdAt: /* @__PURE__ */ new Date()
        } });
      } catch {
      }
    } else if (!perm.id) {
      await repo.create({ values: perm });
      try {
        await logRepo.create({ values: {
          action: "create",
          targetType: perm.targetType,
          targetId: perm.targetId,
          targetName: perm.targetName,
          tableName: perm.tableName,
          changes: { after: perm },
          operatorId,
          createdAt: /* @__PURE__ */ new Date()
        } });
      } catch {
      }
    }
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
// Annotate t