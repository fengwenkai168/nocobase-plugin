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
var export_exports = {};
__export(export_exports, {
  registerExportActions: () => registerExportActions
});
module.exports = __toCommonJS(export_exports);
var import_utils = require("./utils");
var import_permission = require("../services/permission");
var import_export_engine = require("../services/export-engine");
var import_field_meta = require("../services/field-meta");
function registerExportActions(plugin) {
  const permissionService = new import_permission.PermissionService(plugin);
  const engine = new import_export_engine.ExportEngine(plugin);
  plugin.taskQueue.registerHandler("export", async (ctx, params) => {
    return engine.run(ctx, params);
  });
  return {
    "getExportPermissions": async (ctx, next) => {
      const userId = (0, import_utils.currentUserId)(ctx);
      const __p = { ...ctx.action.params || {}, ...ctx.action.params.values || {} };
      const { collectionName } = __p;
      const permissions = await permissionService.listExportPermissions(userId, collectionName || void 0);
      ctx.body = { permissions };
      await next();
    },
    "exportableCollections": async (ctx, next) => {
      const userId = (0, import_utils.currentUserId)(ctx);
      const roleNames = await permissionService.getUserRoleNames(userId);
      const isAdmin = permissionService.isAdmin(roleNames);
      let names;
      if (isAdmin) {
        names = new Set([...plugin.db.collections.values()].map((c) => c.name));
      } else {
        names = /* @__PURE__ */ new Set();
        const models = await plugin.db.getRepository("sjgl02Permissions").find({
          filter: {
            canExport: true,
            $or: [
              { targetType: "user", targetId: String(userId) },
              ...roleNames.length ? [{ targetType: "role", targetId: { $in: roleNames } }] : []
            ]
          }
        });
        for (const m of models) names.add(m.get("collectionName"));
      }
      const collections = [...plugin.db.collections.values()].filter((c) => names.has(c.name)).map((c) => ({ name: c.name, title: (0, import_field_meta.cleanTitle)(c.options.title, c.name) }));
      ctx.body = { collections, isAdmin };
      await next();
    },
    "export": async (ctx, next) => {
      const values = ctx.action.params.values || {};
      const userId = (0, import_utils.currentUserId)(ctx);
      const allTables = !!values.allTables;
      let exportFilter = null;
      let permissionConfigId;
      let permissionType;
      let permissionLabel;
      if (allTables) {
        const roleNames = await permissionService.getUserRoleNames(userId);
        if (!permissionService.isAdmin(roleNames)) {
          ctx.throw(403, "\u300C\u5168\u90E8\u6570\u636E\u8868\uFF08\u542B\u7CFB\u7EDF\u8868\uFF09\u300D\u5BFC\u51FA\u4EC5 admin/root \u53EF\u7528");
        }
      } else {
        if (!values.collectionName) {
          ctx.throw(400, "\u7F3A\u5C11\u53C2\u6570 collectionName");
        }
        const fields = values.fields || [];
        if (!fields.length) {
          ctx.throw(400, "\u672A\u9009\u62E9\u4EFB\u4F55\u5BFC\u51FA\u5B57\u6BB5");
        }
        const { config } = await permissionService.getPermissionForExecution(
          userId,
          values.permissionConfigId === void 0 || values.permissionConfigId === null ? null : Number(values.permissionConfigId)
        );
        if (!config.canExport) {
          ctx.throw(403, "\u8BE5\u6743\u9650\u914D\u7F6E\u4E0D\u5141\u8BB8\u5BFC\u51FA");
        }
        if (config.exportFields.length) {
          const requested = fields.map((f) => f.field);
          const denied = requested.filter((f) => !config.exportFields.includes(f));
          if (denied.length) {
            ctx.throw(403, `\u5B57\u6BB5 ${denied.join(", ")} \u4E0D\u5728\u53EF\u5BFC\u51FA\u5B57\u6BB5\u767D\u540D\u5355\u5185`);
          }
        }
        exportFilter = config.exportFilter;
        permissionConfigId = config.id ?? void 0;
        permissionType = config.targetType;
        permissionLabel = config.targetName ? `${config.targetType === "user" ? "\u{1F464}" : "\u{1F465}"} ${config.targetName}` : void 0;
      }
      const collectionName = allTables ? "__all__" : String(values.collectionName);
      const collection = allTables ? null : plugin.db.getCollection(collectionName);
      const collectionTitle = allTables ? "\u5168\u90E8\u6570\u636E\u8868" : String((collection == null ? void 0 : collection.options.title) || collectionName);
      const taskParams = {
        collectionName,
        allTables,
        fields: values.fields || [],
        headerType: values.headerType || "titleName",
        filter: values.filter || null,
        exportFilter,
        relationFields: values.relationFields || [],
        relationExportMode: values.relationExportMode || "sheet",
        exportAttachment: !!values.exportAttachment,
        globalDateFormat: values.globalDateFormat || "YYYY-MM-DD HH:mm:ss",
        globalRelationFormat: values.globalRelationFormat || "display",
        operatorUserId: userId
      };
      const task = await plugin.taskQueue.submit("export", taskParams, userId, {
        title: `${collectionTitle} \u5BFC\u51FA`,
        collectionName,
        collectionTitle,
        permissionConfigId,
        permissionType,
        permissionLabel
      });
      ctx.body = { taskId: task.get("id") };
      await next();
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerExportActions
});
