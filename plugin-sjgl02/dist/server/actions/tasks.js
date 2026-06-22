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
var tasks_exports = {};
__export(tasks_exports, {
  cancelTask: () => cancelTask,
  getTaskDetail: () => getTaskDetail,
  getTaskLogs: () => getTaskLogs,
  listTasks: () => listTasks
});
module.exports = __toCommonJS(tasks_exports);
async function listTasks(ctx, next) {
  const { page = 1, pageSize = 20, taskType, status } = ctx.action.params;
  const filter = {};
  if (taskType && taskType !== "all") filter.taskType = taskType;
  if (status && status !== "all") filter.status = status;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const [rows, total] = await repo.findAndCount({
    filter,
    page,
    pageSize,
    sort: ["-createdAt"],
    appends: ["createdBy"]
  });
  ctx.body = { data: rows, meta: { total, page, pageSize } };
  await next();
}
async function getTaskDetail(ctx, next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId }, appends: ["createdBy"] });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  ctx.body = { data: task };
  await next();
}
async function getTaskLogs(ctx, next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  ctx.body = {
    data: {
      errorLogs: task.errorLogs || [],
      fieldMapping: task.fieldMapping || null,
      selectedFields: task.selectedFields || null
    }
  };
  await next();
}
async function cancelTask(ctx, next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository("sjgl02_tasks");
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, "Task not found");
  }
  if (["completed", "failed", "cancelled"].includes(task.status)) {
    ctx.throw(400, "Cannot cancel a completed/failed/cancelled task");
  }
  await repo.update({
    filterByTk: task.id,
    values: { status: "cancelled", progress: task.progress }
  });
  ctx.body = { data: { success: true } };
  await next();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cancelTask,
  getTaskDetail,
  getTaskLogs,
  listTasks
});
