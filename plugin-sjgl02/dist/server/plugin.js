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
var plugin_exports = {};
__export(plugin_exports, {
  PluginSjgl02Server: () => PluginSjgl02Server,
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);
var import_utils = require("./actions/utils");
var import_server = require("@nocobase/server");
var import_task_queue = require("./services/task-queue");
var import_import = require("./actions/import");
var import_export = require("./actions/export");
var import_tasks = require("./actions/tasks");
var import_meta = require("./actions/meta");
var import_permissions = require("./actions/permissions");
class PluginSjgl02Server extends import_server.Plugin {
  taskQueue;
  async beforeLoad() {
    (0, import_permissions.registerPermissionLogHooks)(this);
  }
  async load() {
    this.taskQueue = new import_task_queue.TaskQueueService(this);
    this.registerDemoHandler();
    if (!(0, import_server.isTransient)()) {
      this.taskQueue.subscribe();
      this.app.on("afterStart", async () => {
        try {
          await this.taskQueue.recoverStaleTasks();
        } catch (error) {
          this.app.logger.error("[sjgl02] \u542F\u52A8\u6062\u590D\u5931\u8D25", error);
        }
      });
    }
    this.registerAcl();
    this.registerActions();
    const taskActions = (0, import_tasks.registerTaskActions)(this);
    const sjgl02Actions = {
      ...(0, import_import.registerImportActions)(this),
      ...(0, import_export.registerExportActions)(this),
      ...(0, import_meta.registerMetaActions)(this),
      ...(0, import_permissions.registerPermissionActions)(this)
    };
    this.app.resourcer.define({ name: "sjgl02", actions: sjgl02Actions });
    this.app.resourceManager.registerActionHandlers(
      Object.fromEntries(Object.entries(taskActions).map(([k, v]) => [`sjgl02Tasks:${k}`, v]))
    );
  }
  async install() {
  }
  registerAcl() {
    const snippets = [
      [
        "pm.sjgl02.import",
        [
          "sjgl02:importUpload",
          "sjgl02:previewExcel",
          "sjgl02:getImportPermissions",
          "sjgl02:import",
          "sjgl02:downloadTemplate"
        ]
      ],
      ["pm.sjgl02.export", ["sjgl02:getExportPermissions", "sjgl02:export"]],
      [
        "pm.sjgl02.tasks",
        [
          "sjgl02Tasks:list",
          "sjgl02Tasks:get",
          "sjgl02Tasks:cancel",
          "sjgl02Tasks:download",
          "sjgl02Tasks:exportErrorReport",
          "sjgl02Tasks:retry"
        ]
      ],
      ["pm.sjgl02.permission", ["sjgl02Permissions:*", "sjgl02PermissionLogs:list", "sjgl02:permListByCollection"]]
    ];
    for (const [name, actions] of snippets) {
      this.app.acl.registerSnippet({ name, actions });
    }
    this.app.acl.allow(
      "sjgl02Tasks",
      [
        "list",
        "get",
        "cancel",
        "testSubmit",
        "stats",
        "download",
        "exportErrorReport",
        "retry",
        "getScope",
        "setScope"
      ],
      "loggedIn"
    );
    this.app.acl.allow("sjgl02Permissions", "*", "loggedIn");
    this.app.acl.allow("sjgl02PermissionLogs", ["list", "get"], "loggedIn");
    this.app.acl.allow("sjgl02", "*", "loggedIn");
  }
  registerActions() {
    this.app.resourceManager.registerActionHandlers({
      "sjgl02Tasks:cancel": async (ctx, next) => {
        const taskId = Number(ctx.action.params.filterByTk ?? ctx.action.params.taskId);
        if (!taskId) {
          ctx.throw(400, "\u7F3A\u5C11 taskId");
        }
        await this.taskQueue.cancel(taskId);
        ctx.body = { ok: true };
        await next();
      },
      // M1 开发自验接口：提交一个 demo 任务（按秒推进进度，可取消）
      "sjgl02Tasks:testSubmit": async (ctx, next) => {
        var _a;
        const seconds = Math.min(Math.max(Number(((_a = ctx.action.params.values) == null ? void 0 : _a.seconds) ?? 10), 1), 300);
        const userId = (0, import_utils.currentUserId)(ctx);
        const task = await this.taskQueue.submit("demo", { seconds }, userId, { title: `\u6F14\u793A\u4EFB\u52A1\uFF08${seconds}s\uFF09` });
        ctx.body = { taskId: task.get("id") };
        await next();
      }
    });
  }
  registerDemoHandler() {
    this.taskQueue.registerHandler("demo", async (ctx, params) => {
      const seconds = Number(params.seconds ?? 10);
      await ctx.updateProgress(0, seconds);
      for (let i = 1; i <= seconds; i++) {
        ctx.throwIfAborted();
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        await ctx.updateProgress(i, seconds);
        await ctx.updateStats({ totalRows: seconds, successRows: i });
      }
      return { message: "demo \u4EFB\u52A1\u5B8C\u6210", seconds };
    });
  }
}
var plugin_default = PluginSjgl02Server;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PluginSjgl02Server
});
