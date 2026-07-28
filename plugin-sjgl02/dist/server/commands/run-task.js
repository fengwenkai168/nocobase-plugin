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
var run_task_exports = {};
__export(run_task_exports, {
  default: () => runTaskCommand
});
module.exports = __toCommonJS(run_task_exports);
var import_task_queue = require("../services/task-queue");
var import_import_engine = require("../services/import-engine");
var import_export_engine = require("../services/export-engine");
function runTaskCommand(app) {
  app.command("sjgl02:run-task").preload().option("--taskId <taskId>").action(async (options) => {
    const taskId = Number(options.taskId);
    let code = 0;
    try {
      await app.db.getRepository("collections").load({});
      const loaded = app.pm.get("@my-project/plugin-sjgl02");
      if (loaded == null ? void 0 : loaded.taskQueue) {
        await loaded.taskQueue.executeAsWorker(taskId);
      } else {
        const adapter = { db: app.db, app };
        const taskQueue = new import_task_queue.TaskQueueService(adapter);
        taskQueue.registerHandler(
          "import",
          (ctx, params) => new import_import_engine.ImportEngine(adapter).run(ctx, params)
        );
        taskQueue.registerHandler(
          "export",
          (ctx, params) => new import_export_engine.ExportEngine(adapter).run(ctx, params)
        );
        await taskQueue.executeAsWorker(taskId);
      }
    } catch (error) {
      code = 1;
      app.logger.error(`[sjgl02] \u4EFB\u52A1 #${taskId} worker \u547D\u4EE4\u6267\u884C\u5F02\u5E38`, error);
    } finally {
      try {
        await app.stop({ logging: false });
      } catch {
      }
      process.exit(code);
    }
  });
}
