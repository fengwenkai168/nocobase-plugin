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
var import_permission_service = require("../services/permission-service");
async function checkImportPermission(ctx, tableName, permSource) {
  const currentUser = ctx.state.currentUser;
  if (!currentUser) {
    ctx.throw(401, "\u8BF7\u5148\u767B\u5F55");
  }
  const service = new import_permission_service.PermissionService(ctx.db);
  try {
    return await service.checkPermission(currentUser.id, tableName, "import", permSource);
  } catch (err) {
    ctx.throw(403, err.message || "\u5BFC\u5165\u6743\u9650\u6821\u9A8C\u5931\u8D25");
  }
}
async function checkExportPermission(ctx, tableName, permSource) {
  const currentUser = ctx.state.currentUser;
  if (!currentUser) {
    ctx.throw(401, "\u8BF7\u5148\u767B\u5F55");
  }
  const service = new import_permission_service.PermissionService(ctx.db);
  try {
    return await service.checkPermission(currentUser.id, tableName, "export", permSource);
  } catch (err) {
    ctx.throw(403, err.message || "\u5BFC\u51FA\u6743\u9650\u6821\u9A8C\u5931\u8D25");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkExportPermission,
  checkImportPermission
});
