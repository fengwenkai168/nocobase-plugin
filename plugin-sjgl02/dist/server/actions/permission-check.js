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
var permission_check_exports = {};
__export(permission_check_exports, {
  checkExportPermission: () => checkExportPermission,
  checkImportPermission: () => checkImportPermission
});
module.exports = __toCommonJS(permission_check_exports);
async function checkImportPermission(ctx, tableName) {
  return checkTablePermission(ctx, tableName, "import");
}
async function checkExportPermission(ctx, tableName) {
  return checkTablePermission(ctx, tableName, "export");
}
async function checkTablePermission(ctx, tableName, actionType) {
  const currentUser = ctx.state.currentUser;
  if (!currentUser) {
    ctx.throw(401, "\u8BF7\u5148\u767B\u5F55");
  }
  const permRepo = ctx.db.getRepository("sjgl02_table_permissions");
  const userRepo = ctx.db.getRepository("users");
  let user = null;
  let roleNames = [];
  try {
    user = await userRepo.findOne({ filterByTk: currentUser.id, appends: ["roles"] });
    roleNames = ((user == null ? void 0 : user.roles) || []).map((r) => r.name);
  } catch {
  }
  const roleRepo = ctx.db.getRepository("roles");
  let isAdminOrRoot = false;
  try {
    if (roleNames.length > 0) {
      const roles = await roleRepo.find({ filter: { name: { $in: roleNames } } });
      isAdminOrRoot = roles.some((r) => r.name === "admin" || r.name === "root");
    }
  } catch {
  }
  if (isAdminOrRoot) {
    return {
      canImport: true,
      canExport: true,
      importMode: ["insert", "update", "upsert"],
      importFields: [],
      exportFields: [],
      exportFilter: null,
      uniqueFields: [],
      requiredFields: []
    };
  }
  let userPerm = null;
  try {
    userPerm = await permRepo.findOne({
      filter: { targetType: "user", targetId: String(currentUser.id), tableName }
    });
  } catch {
  }
  if (userPerm) {
    const fieldName = actionType === "import" ? "canImport" : "canExport";
    if (!userPerm[fieldName]) {
      ctx.throw(403, `\u60A8\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C${tableName}\u300D\u7684${actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA"}\u6743\u9650\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458`);
    }
    return {
      canImport: userPerm.canImport ?? false,
      canExport: userPerm.canExport ?? false,
      importMode: Array.isArray(userPerm.importMode) ? userPerm.importMode : [userPerm.importMode || "insert"],
      importFields: userPerm.importFields || [],
      exportFields: userPerm.exportFields || [],
      exportFilter: userPerm.exportFilter || null,
      uniqueFields: userPerm.uniqueFields || [],
      requiredFields: userPerm.requiredFields || []
    };
  }
  if (roleNames.length > 0) {
    let rolePerm = null;
    try {
      const rolePerms = await permRepo.find({
        filter: { targetType: "role", targetId: { $in: roleNames }, tableName }
      });
      const fieldName = actionType === "import" ? "canImport" : "canExport";
      const allowedPerms = rolePerms.filter((p) => p[fieldName] === true);
      if (allowedPerms.length > 0) {
        rolePerm = { ...allowedPerms[0] };
        rolePerm.importMode = [...new Set(allowedPerms.flatMap((p) => p.importMode || []))];
      }
    } catch {
    }
    if (rolePerm) {
      const fieldName = actionType === "import" ? "canImport" : "canExport";
      if (!rolePerm[fieldName]) {
        ctx.throw(403, `\u60A8\u7684\u89D2\u8272\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C${tableName}\u300D\u7684${actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA"}\u6743\u9650\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458`);
      }
      return {
        canImport: rolePerm.canImport ?? false,
        canExport: rolePerm.canExport ?? false,
        importMode: Array.isArray(rolePerm.importMode) ? rolePerm.importMode : [rolePerm.importMode || "insert"],
        importFields: rolePerm.importFields || [],
        exportFields: rolePerm.exportFields || [],
        exportFilter: rolePerm.exportFilter || null,
        uniqueFields: rolePerm.uniqueFields || [],
        requiredFields: rolePerm.requiredFields || []
      };
    }
  }
  ctx.throw(403, `\u60A8\u6CA1\u6709\u5BF9\u6570\u636E\u8868\u300C${tableName}\u300D\u7684${actionType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA"}\u6743\u9650\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkExportPermission,
  c