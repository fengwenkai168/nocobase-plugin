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
  const users = await userRepo.find({ limit: 50 });
  const roles = await roleRepo.find({ limit: 20 });
  ctx.body = {
    data: {
      users: users.map((u) => ({
        id: u.id,
        nickname: u.nickname || u.username || u.email,
        type: "user"
      })),
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        title: r.title,
        type: "role"
      }))
    }
  };
  await next();
}
async function getTables(ctx, next) {
  const collectionManager = ctx.db.collectionManager || ctx.db;
  let collections = [];
  try {
    if (typeof collectionManager.getCollections === "function") {
      collections = Array.from(collectionManager.getCollections().values() || []);
    } else if (collectionManager.collections instanceof Map) {
      collections = Array.from(collectionManager.collections.values());
    } else if (collectionManager.collections) {
      collections = Object.values(collectionManager.collections);
    }
  } catch {
    collections = [];
  }
  const tables = collections.filter((c) => {
    try {
      return !(c.isThrough && c.isThrough());
    } catch {
      return true;
    }
  }).map((c) => {
    var _a;
    return {
      name: c.name,
      title: ((_a = c.options) == null ? void 0 : _a.title) || c.name
    };
  });
  ctx.body = { data: tables };
  await next();
}
async function getPermissions(ctx, next) {
  const { targetType, targetId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_table_permissions");
  const permissions = await repo.find({ filter: { targetType, targetId } });
  ctx.body = { data: permissions };
  await next();
}
async function savePermissions(ctx, next) {
  const { permissions } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_table_permissions");
  for (const perm of permissions) {
    if (perm.id) {
      await repo.update({
        filterByTk: perm.id,
        values: perm
      });
    } else {
      await repo.create({ values: perm });
    }
  }
  ctx.body = { data: { success: true } };
  await next();
}
async function getSettings(ctx, next) {
  const repo = ctx.db.getRepository("sjgl02_settings");
  let settings = await repo.findOne();
  if (!settings) {
    settings = await repo.create({
      values: { taskViewScope: "own", maxFileSize: 50, batchSize: 1e3 }
    });
  }
  ctx.body = { data: settings };
  await next();
}
async function saveSettings(ctx, next) {
  const values = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_settings");
  let settings = await repo.findOne();
  if (settings) {
    await repo.update({ filterByTk: settings.id, values });
  } else {
    await repo.create({ values });
  }
  ctx.body = { data: { success: true } };
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
