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
var taskLogs_exports = {};
__export(taskLogs_exports, {
  listTaskLogs: () => listTaskLogs,
  writeTaskLog: () => writeTaskLog
});
module.exports = __toCommonJS(taskLogs_exports);
async function listTaskLogs(ctx, next) {
  const { taskId } = ctx.action.params;
  const page = Math.max(1, parseInt(ctx.action.params.page || "1", 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(ctx.action.params.pageSize || "100", 10) || 100));
  const repo = ctx.db.getRepository("sjgl02_task_logs");
  const [rows, total] = await repo.findAndCount({
    filter: { taskId: parseInt(taskId, 10) || 0 },
    sort: ["timestamp"],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  ctx.body = { items: rows, total, page, pageSize };
  await next();
}
async function writeTaskLog(db, taskId, level, message) {
  try {
    const repo = db.getRepository("sjgl02_task_logs");
    await repo.create({ values: { taskId, level, message, timestamp: /* @__PURE__ */ new Date() } });
  } catch (e) {
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  listTaskLogs,
  writeTaskLog
});
