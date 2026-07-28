/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var import_node_worker_threads = require("node:worker_threads");
var import_server = require("@nocobase/server");
var import_database = require("@nocobase/database");
var import_task_queue = require("./task-queue");
var import_import_engine = require("./import-engine");
var import_export_engine = require("./export-engine");
async function main() {
  const { taskId } = import_node_worker_threads.workerData;
  await (0, import_server.runPluginStaticImports)();
  const app = new import_server.Application({
    database: await (0, import_database.parseDatabaseOptionsFromEnv)(),
    plugins: ["nocobase"]
  });
  await app.load();
  await app.db.getRepository("collections").load({});
  const plugin = app.pm.get("@my-project/plugin-sjgl02");
  if (plugin == null ? void 0 : plugin.taskQueue) {
    await plugin.taskQueue.executeAsWorker(taskId);
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
  try {
    await app.stop({ logging: false });
  } catch {
  }
  process.exit(0);
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[sjgl02] worker-entry \u5F02\u5E38: ${message}`, error);
  process.exit(1);
});
