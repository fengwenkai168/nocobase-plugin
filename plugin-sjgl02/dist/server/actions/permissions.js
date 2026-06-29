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
  const users = await userRepo.find({ limit: 500, sort: ["id"] });
  const roles = await roleRepo.find({ limit: 200, sort: ["name"] });
  ctx.body = {
    users: users.map((u) => ({
      id: String(u.id),
      nickname: u.nickname || u.username || u.email,
      type: "user"
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
    ctx.body = [];
    await next();
    return;
  }
  if (targetType === "role") {
    try {
      const roleRepo = ctx.db.getRepository("roles");
      const role = await roleRepo.findOne({ filter: { name: targetId } });
      if ((role == null ? void 0 : role.name) === "admin" || (role == null ? void 0 : role.name) === "root") {
        const repo2 = ctx.db.getRepository("sjgl02_table_permissions");
        const existing = await repo2.find({ filter: { targetType: "role", targetId: String(targetId) } });
        const existingNames = new Set(existing.map((p) => p.tableName));
        const tables = ctx.db.collections;
        for (const [name] of tables) {
          if (name.startsWith("sjgl02_")) continue;
          if (!existingNames.has(name)) {
            await repo2.create({
              values: {
                targetType: "role",
                targetId: String(targetId),
                targetName: "\u7BA1\u7406\u5458",
                tableName: name,
                canImport: true,
                canExport: true,
                importMode: ["insert", "update", "upsert"],
                uniqueFields: [],
                requiredFields: [],
                importFields: [],
                exportFields: []
              }
            });
          }
        }
      }
    } catch {
    }
  }
  const repo = ctx.db.getRepository("sjgl02_table_permissions");
  const permissions = await repo.find({ filter: { targetType, targetId: String(targetId) } });
  ctx.body = permissions;
  await next();
}
async function savePermissions(ctx, next) {
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
    ctx.body = { suc