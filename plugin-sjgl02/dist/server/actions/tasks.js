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
  cancelTask: () => cancelTask,
  deleteTask: () => deleteTask,
  getTaskDetail: () => getTaskDetail,
  listTasks: () => listTasks
});
module.exports = __toCommonJS(tasks_exports);
var import_import_utils = require("./import-utils");
var import_auth_utils = require("./auth-utils");
async function listTasks(ctx, next) {
  var _a, _b;
  const { taskType, status, search } = ctx.action.params;
  const page = Math.max(1, parseInt(ctx.action.params.page || "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(ctx.action.params.pageSize || "20", 10) || 20));
  const filter = {};
  if (taskType && taskType !== "all") filter.taskType = taskType;
  if (status && status !== "all") filter.status = status;
  if (search && String(search).trim()) {
    const kw = String(search).trim();
    const isNum = /^\d+$/.test(kw);
    const orConditions = [isNum ? { id: parseInt(kw, 10) } : null, { tableName: { $iLike: `%${kw}%` } }].filter(
      Boolean
    );
    try {
      const userRepo = ctx.db.getRepository("users");
      const matchedUsers = await userRepo.find({
        filter: { nickname: { $iLike: `%${kw}%` } }
      });
      if (matchedUsers.length > 0) {
        orConditions.push({
          createdById: { $in: matchedUsers.map((u) => u.id) }
        });
      }
    } catch {
    }
    filter.$or = orConditions;
  }
  const taskViewScope = await getTaskViewScope(ctx);
  if (taskViewScope === "own") {
    if (filter.$or) {
      const baseFilter = { createdById: ((_a = ctx.state.currentUser) == null ? void 0 : _a.id) ?? -1 };
      filter.$and = [baseFilter, { $or: filter.$or }];
      delete filter.$or;
    } else {
      filter.createdById = ((_b = ctx.state.currentUser) == null ? void 0 : _b.id) ?? -1;
    }
  }
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const [rows, total] = await repo.findAndCount({
    filter,
    appends: ["createdBy"],
    page,
    pageSize,
    sort: ["-createdAt"]
  });
  ctx.body = {
    items: rows,
    total,
    page,
    pageSize
  };
  await next();
}
async function getTaskDetail(ctx, next) {
  var _a, _b;
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({
    filter: { id: taskId },
    appends: ["createdBy"]
  });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  const currentUserId = (_a = ctx.state.currentUser) == null ? void 0 : _a.id;
  const isAdmin = (((_b = ctx.state.currentUser) == null ? void 0 : _b.roles) || []).some((r) => r.name === "admin" || r.name === "root");
  const taskViewScope = await getTaskViewScope(ctx);
  if (!isAdmin && taskViewScope === "own" && task.createdById !== currentUserId) {
    ctx.throw(403, "Access denied");
  }
  ctx.body = task;
  await next();
}
async function cancelTask(ctx, next) {
  var _a;
  const params = ctx.action.params.values || ctx.action.params;
  const { taskId } = params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  const currentUserId = (_a = ctx.state.currentUser) == null ? void 0 : _a.id;
  if (!(0, import_auth_utils.isAdminOrRoot)(ctx) && task.createdById !== currentUserId) {
    ctx.throw(403, "\u53EA\u80FD\u53D6\u6D88\u81EA\u5DF1\u521B\u5EFA\u7684\u4EFB\u52A1");
  }
  if (["completed", "failed", "cancelled"].includes(task.status)) {
    ctx.throw(400, "Cannot cancel a completed/failed/cancelled task");
  }
  const taskIdNum = Number(taskId);
  if (task.taskType === "import") {
    try {
      const quotedShadow = (0, import_import_utils.quoteIdentifier)("_sjgl02_import_" + taskIdNum);
      await ctx.db.sequelize.query("DROP TABLE IF EXISTS " + quotedShadow);
    } catch {
    }
  }
  await repo.update({
    filterByTk: task.id,
    values: { status: "cancelled", progress: task.progress }
  });
  if (task.taskType === "export") {
    try {
      const { activeWorkers } = await import("../workers/zombie-guard");
      const child = activeWorkers.get(taskIdNum);
      if (child && !child.killed) child.kill("SIGTERM");
    } catch {
    }
  }
  ctx.body = { success: true };
  await next();
}
async function deleteTask(ctx, next) {
  var _a;
  const params = ctx.action.params.values || ctx.action.params;
  const { taskId } = params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  if (!(0, import_auth_utils.isAdminOrRoot)(ctx) && task.createdById !== ((_a = ctx.state.currentUser) == null ? void 0 : _a.id)) {
    ctx.throw(403, "\u53EA\u80FD\u5220\u9664\u81EA\u5DF1\u521B\u5EFA\u7684\u4EFB\u52A1");
  }
  await ctx.db.getRepository("sjgl02_task_logs").destroy({ filter: { taskId } });
  await repo.destroy({ filterByTk: task.id });
  ctx.body = { success: true };
  await next();
}
async function getTaskViewScope(ctx) {
  var _a, _b;
  try {
    const roleNames = (((_a = ctx.state.currentUser) == null ? void 0 : _a.roles) || []).map((r) => r.name);
    if (roleNames.length > 0) {
      const roleRepo = ctx.db.getRepository("roles");
      const userRoles = await roleRepo.find({ filter: { name: { $in: roleNames } } });
      if (userRoles.some((r) => r.name === "admin" || r.name === "root")) return "all";
    }
    const settingRepo = ctx.db.getRepository("sjgl02_settings");
    const userId = (_b = ctx.state.currentUser) == null ? void 0 : _b.id;
    const userSetting = await settingRepo.findOne({ filter: { userId } });
    if (userSetting) return userSetting.taskViewScope || "own";
    const globalSetting = await settingRepo.findOne({ filter: { userId: { $is: null } } });
    return (globalSetting == null ? void 0 : globalSetting.taskViewScope) || "own";
  } catch {
    return "own";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cancelTask,
  deleteTask,
  getTaskDetail,
  listTasks
});
