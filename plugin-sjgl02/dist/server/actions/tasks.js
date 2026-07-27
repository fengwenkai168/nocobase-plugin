/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var tasks_exports = {};
__export(tasks_exports, {
  registerTaskActions: () => registerTaskActions
});
module.exports = __toCommonJS(tasks_exports);
var import_utils = require("./utils");
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_permission = require("../services/permission");
const ACTIVE_STATUSES = ["pending", "running"];
function encodeFileName(name) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
}
function registerTaskActions(plugin) {
  const permissionService = new import_permission.PermissionService(plugin);
  async function getScope(userId) {
    const record = await plugin.db.getRepository("sjgl02UserSettings").findOne({ filter: { userId } });
    return (record == null ? void 0 : record.get("taskScope")) || "self";
  }
  async function canViewAll(userId) {
    const roleNames = await permissionService.getUserRoleNames(userId);
    if (permissionService.isAdmin(roleNames)) return true;
    return await getScope(userId) === "all";
  }
  plugin.app.resourcer.use(
    async (ctx, next) => {
      const { resourceName, actionName } = ctx.action;
      if (resourceName === "sjgl02Tasks" && ["list", "get"].includes(actionName)) {
        const userId = (0, import_utils.currentUserId)(ctx);
        if (userId && !await canViewAll(userId)) {
          const existing = ctx.action.params.filter;
          const scopeFilter = { createdById: userId };
          ctx.action.mergeParams({
            filter: existing && Object.keys(existing).length ? { $and: [existing, scopeFilter] } : scopeFilter
          });
        }
      }
      await next();
    },
    { tag: "sjgl02TaskScope", after: "auth" }
  );
  return {
    "stats": async (ctx, next) => {
      const repo = plugin.db.getRepository("sjgl02Tasks");
      const userId = (0, import_utils.currentUserId)(ctx);
      const filter = {};
      if (userId && !await canViewAll(userId)) {
        filter.createdById = userId;
      }
      const tasks = await repo.find({ filter, fields: ["status"] });
      const counts = { total: 0, succeeded: 0, running: 0, pending: 0, failed: 0, canceled: 0 };
      for (const task of tasks) {
        const status = task.get("status");
        counts.total += 1;
        if (status in counts) counts[status] += 1;
      }
      ctx.body = counts;
      await next();
    },
    "download": async (ctx, next) => {
      var _a, _b;
      const taskId = Number(ctx.action.params.filterByTk);
      const type = ctx.action.params.type || "result";
      const task = await plugin.db.getRepository("sjgl02Tasks").findOne({ filter: { id: taskId } });
      if (!task) ctx.throw(404, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
      const userId = (0, import_utils.currentUserId)(ctx);
      if (userId && !await canViewAll(userId) && Number(task.get("createdById")) !== userId) {
        ctx.throw(403, "\u65E0\u6743\u4E0B\u8F7D\u8BE5\u4EFB\u52A1\u6587\u4EF6");
      }
      let filePath = null;
      let fileName = "download";
      if (type === "source" && task.get("type") === "import") {
        filePath = (_a = task.get("params")) == null ? void 0 : _a.filePath;
        fileName = (_b = task.get("params")) == null ? void 0 : _b.fileName;
      } else {
        filePath = task.get("filePath");
        fileName = task.get("fileName") || fileName;
      }
      if (!filePath || !import_node_fs.default.existsSync(filePath)) {
        ctx.throw(404, "\u6587\u4EF6\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u6E05\u7406");
      }
      const stat = import_node_fs.default.statSync(filePath);
      ctx.set("Content-Type", "application/octet-stream");
      ctx.set("Content-Length", String(stat.size));
      ctx.set("Content-Disposition", encodeFileName(fileName || import_node_path.default.basename(filePath)));
      ctx.body = import_node_fs.default.createReadStream(filePath);
      await next();
    },
    "exportErrorReport": async (ctx, next) => {
      const taskId = Number(ctx.action.params.filterByTk);
      const task = await plugin.db.getRepository("sjgl02Tasks").findOne({ filter: { id: taskId } });
      if (!task) ctx.throw(404, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
      const userId = (0, import_utils.currentUserId)(ctx);
      if (userId && !await canViewAll(userId) && Number(task.get("createdById")) !== userId) {
        ctx.throw(403, "\u65E0\u6743\u4E0B\u8F7D\u8BE5\u4EFB\u52A1\u9519\u8BEF\u62A5\u544A");
      }
      const result = task.get("result") || {};
      const errors = result.errors || [];
      const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = ["\u884C\u53F7,\u5B57\u6BB5,\u9519\u8BEF\u539F\u56E0,\u539F\u59CB\u6570\u636E"];
      for (const e of errors) {
        lines.push([e.row, escape(e.field), escape(e.reason), escape(e.raw)].join(","));
      }
      const csv = "\uFEFF" + lines.join("\n");
      ctx.withoutDataWrapping = true;
      ctx.set("Content-Type", "text/csv; charset=utf-8");
      ctx.set("Content-Disposition", encodeFileName(`\u9519\u8BEF\u62A5\u544A-\u4EFB\u52A1${taskId}.csv`));
      ctx.body = csv;
      await next();
    },
    "retry": async (ctx, next) => {
      const taskId = Number(ctx.action.params.filterByTk);
      const task = await plugin.db.getRepository("sjgl02Tasks").findOne({ filter: { id: taskId } });
      if (!task) ctx.throw(404, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
      const type = task.get("type");
      if (!["import", "export"].includes(type)) {
        ctx.throw(400, "\u4EC5\u5BFC\u5165/\u5BFC\u51FA\u4EFB\u52A1\u53EF\u91CD\u65B0\u6267\u884C");
      }
      const params = task.get("params") || {};
      params.operatorUserId = (0, import_utils.currentUserId)(ctx);
      const newTask = await plugin.taskQueue.submit(type, params, (0, import_utils.currentUserId)(ctx), {
        title: `${task.get("title") || task.get("collectionName")}\uFF08\u91CD\u8BD5\uFF09`,
        collectionName: task.get("collectionName"),
        collectionTitle: task.get("collectionTitle"),
        permissionConfigId: task.get("permissionConfigId"),
        permissionType: task.get("permissionType")
      });
      ctx.body = { taskId: newTask.get("id") };
      await next();
    },
    "getScope": async (ctx, next) => {
      const targetUserId = Number(ctx.action.params.userId || (0, import_utils.currentUserId)(ctx));
      ctx.body = { userId: targetUserId, scope: await getScope(targetUserId) };
      await next();
    },
    "setScope": async (ctx, next) => {
      const { userId: targetUserIdRaw, scope } = ctx.action.params.values || {};
      const operatorId = (0, import_utils.currentUserId)(ctx);
      const targetUserId = Number(targetUserIdRaw || operatorId);
      if (targetUserId !== operatorId) {
        const roleNames = await permissionService.getUserRoleNames(operatorId);
        if (!permissionService.isAdmin(roleNames)) {
          ctx.throw(403, "\u4EC5 admin/root \u53EF\u4FEE\u6539\u5176\u4ED6\u7528\u6237\u7684\u67E5\u770B\u8303\u56F4");
        }
      }
      if (!["self", "all"].includes(scope)) {
        ctx.throw(400, "scope \u5FC5\u987B\u4E3A self \u6216 all");
      }
      const repo = plugin.db.getRepository("sjgl02UserSettings");
      const existing = await repo.findOne({ filter: { userId: targetUserId } });
      if (existing) {
        await repo.update({ filter: { userId: targetUserId }, values: { taskScope: scope } });
      } else {
        await repo.create({ values: { userId: targetUserId, taskScope: scope } });
      }
      ctx.body = { userId: targetUserId, scope };
      await next();
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerTaskActions
});
