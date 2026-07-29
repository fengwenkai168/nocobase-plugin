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
var task_queue_exports = {};
__export(task_queue_exports, {
  TASK_CHANNEL: () => TASK_CHANNEL,
  TASK_STATUS: () => TASK_STATUS,
  TaskQueueService: () => TaskQueueService
});
module.exports = __toCommonJS(task_queue_exports);
var import_worker_task_runner = require("./worker-task-runner");
const TASK_CHANNEL = "sjgl02:task";
const WORKER_MIN_ROWS = 1e4;
const TASK_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled"
};
class TaskQueueService {
  constructor(plugin) {
    this.plugin = plugin;
  }
  handlers = /* @__PURE__ */ new Map();
  controllers = /* @__PURE__ */ new Map();
  processing = /* @__PURE__ */ new Set();
  get repo() {
    return this.plugin.db.getRepository("sjgl02Tasks");
  }
  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }
  subscribe() {
    this.plugin.app.eventQueue.subscribe(TASK_CHANNEL, {
      interval: 500,
      concurrency: 1,
      idle: () => this.processing.size === 0,
      process: async (message) => {
        await this.execute(Number(message.taskId));
      }
    });
  }
  async submit(type, params, userId, options = {}) {
    const task = await this.repo.create({
      values: {
        type,
        status: TASK_STATUS.PENDING,
        params,
        createdById: userId,
        ...options
      },
      context: { state: { currentUser: { id: userId } } }
    });
    await this.plugin.app.eventQueue.publish(TASK_CHANNEL, { taskId: task.get("id") });
    return task;
  }
  async cancel(taskId) {
    var _a;
    const task = await this.repo.findOne({ filter: { id: taskId } });
    if (!task) {
      throw new Error(`\u4EFB\u52A1 #${taskId} \u4E0D\u5B58\u5728`);
    }
    const status = task.get("status");
    if (status === TASK_STATUS.PENDING) {
      await this.repo.update({
        filter: { id: taskId },
        values: { status: TASK_STATUS.CANCELED, doneAt: /* @__PURE__ */ new Date(), message: "\u6392\u961F\u4E2D\u88AB\u53D6\u6D88" }
      });
      return;
    }
    if (status === TASK_STATUS.RUNNING) {
      (_a = this.controllers.get(taskId)) == null ? void 0 : _a.abort();
      return;
    }
    throw new Error(`\u4EFB\u52A1 #${taskId} \u5F53\u524D\u72B6\u6001\uFF08${status}\uFF09\u4E0D\u5141\u8BB8\u53D6\u6D88`);
  }
  async execute(taskId, options = {}) {
    const task = await this.repo.findOne({ filter: { id: taskId } });
    if (!task) {
      return;
    }
    if (!options.externalSignal && task.get("status") !== TASK_STATUS.PENDING) {
      return;
    }
    if (!options.externalSignal && this.shouldRunInWorker(task)) {
      await this.executeViaWorker(taskId, task);
      return;
    }
    const controller = new AbortController();
    if (options.externalSignal) {
      if (options.externalSignal.aborted) controller.abort();
      else options.externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    this.controllers.set(taskId, controller);
    this.processing.add(taskId);
    const startedAt = /* @__PURE__ */ new Date();
    await this.repo.update({ filter: { id: taskId }, values: { status: TASK_STATUS.RUNNING, startedAt } });
    let lastProgressWrite = 0;
    const ctx = {
      taskId,
      signal: controller.signal,
      updateProgress: async (current, total) => {
        const now = Date.now();
        if (now - lastProgressWrite < 500 && current < (total ?? Number.MAX_SAFE_INTEGER)) {
          return;
        }
        lastProgressWrite = now;
        const values = { progressCurrent: current };
        if (total !== void 0) {
          values.progressTotal = total;
        }
        await this.repo.update({ filter: { id: taskId }, values });
      },
      updateStats: async (stats) => {
        await this.repo.update({ filter: { id: taskId }, values: stats });
      },
      throwIfAborted: () => {
        if (controller.signal.aborted) {
          throw new Error("__aborted__");
        }
      }
    };
    const doneAt = () => /* @__PURE__ */ new Date();
    const duration = () => Math.round((Date.now() - startedAt.getTime()) / 1e3);
    try {
      const type = task.get("type");
      const handler = this.handlers.get(type);
      if (!handler) {
        throw new Error(`\u672A\u6CE8\u518C\u7684\u4EFB\u52A1\u7C7B\u578B: ${type}`);
      }
      const result = await handler(ctx, task.get("params") || {});
      await this.repo.update({
        filter: { id: taskId },
        values: { status: TASK_STATUS.SUCCEEDED, result: result ?? null, doneAt: doneAt(), duration: duration() }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (controller.signal.aborted || message === "__aborted__") {
        await this.repo.update({
          filter: { id: taskId },
          values: {
            status: TASK_STATUS.CANCELED,
            doneAt: doneAt(),
            duration: duration(),
            message: "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF0C\u4E25\u683C\u6A21\u5F0F\u4E0B\u5DF2\u5199\u5165\u6570\u636E\u5168\u90E8\u56DE\u6EDA"
          }
        });
      } else {
        this.plugin.app.logger.error(`[sjgl02] \u4EFB\u52A1 #${taskId} \u6267\u884C\u5931\u8D25: ${message}`, error);
        const details = error.details;
        await this.repo.update({
          filter: { id: taskId },
          values: {
            status: TASK_STATUS.FAILED,
            doneAt: doneAt(),
            duration: duration(),
            message,
            ...details ? { result: details } : {}
          }
        });
      }
    } finally {
      this.controllers.delete(taskId);
      this.processing.delete(taskId);
    }
  }
  shouldRunInWorker(task) {
    const type = task.get("type");
    if (type !== "import" && type !== "export") return false;
    const params = task.get("params") || {};
    if (typeof params.plannedRows === "number") return params.plannedRows >= WORKER_MIN_ROWS;
    if (type === "export" && params.allTables) return true;
    return false;
  }
  async executeViaWorker(taskId, task) {
    const controller = new AbortController();
    this.controllers.set(taskId, controller);
    this.processing.add(taskId);
    const startedAt = /* @__PURE__ */ new Date();
    await this.repo.update({ filter: { id: taskId }, values: { status: TASK_STATUS.RUNNING, startedAt } });
    try {
      await new import_worker_task_runner.WorkerTaskRunner(this.plugin).run(taskId, controller.signal);
      await this.ensureNotRunning(taskId, startedAt, controller.signal.aborted ? null : "\u6267\u884C\u8FDB\u7A0B\u5DF2\u9000\u51FA\u4F46\u672A\u5199\u5165\u7EC8\u6001");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (controller.signal.aborted) {
        await this.repo.update({
          filter: { id: taskId, status: [TASK_STATUS.RUNNING, TASK_STATUS.PENDING] },
          values: {
            status: TASK_STATUS.CANCELED,
            doneAt: /* @__PURE__ */ new Date(),
            message: "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF0C\u4E25\u683C\u6A21\u5F0F\u4E0B\u5DF2\u5199\u5165\u6570\u636E\u5168\u90E8\u56DE\u6EDA"
          }
        });
      } else {
        this.plugin.app.logger.error(`[sjgl02] \u4EFB\u52A1 #${taskId} worker \u6267\u884C\u5931\u8D25: ${message}`, error);
        await this.ensureNotRunning(taskId, startedAt, message);
      }
    } finally {
      this.controllers.delete(taskId);
      this.processing.delete(taskId);
    }
  }
  async ensureNotRunning(taskId, startedAt, message) {
    if (!message) {
      await this.repo.update({
        filter: { id: taskId, status: [TASK_STATUS.RUNNING, TASK_STATUS.PENDING] },
        values: {
          status: TASK_STATUS.CANCELED,
          doneAt: /* @__PURE__ */ new Date(),
          message: "\u4EFB\u52A1\u5DF2\u53D6\u6D88\uFF0C\u4E25\u683C\u6A21\u5F0F\u4E0B\u5DF2\u5199\u5165\u6570\u636E\u5168\u90E8\u56DE\u6EDA"
        }
      });
      return;
    }
    await this.repo.update({
      filter: { id: taskId, status: [TASK_STATUS.RUNNING, TASK_STATUS.PENDING] },
      values: {
        status: TASK_STATUS.FAILED,
        doneAt: /* @__PURE__ */ new Date(),
        duration: Math.round((Date.now() - startedAt.getTime()) / 1e3),
        message
      }
    });
  }
  // worker 子进程入口：sjgl02:run-task 命令调用，复用进程内执行逻辑并接入父进程取消信号
  async executeAsWorker(taskId) {
    const { parentPort } = await import("node:worker_threads");
    const abort = new AbortController();
    parentPort == null ? void 0 : parentPort.on("message", (m) => {
      if (m && m.type === "cancel") abort.abort();
    });
    await this.execute(taskId, { externalSignal: abort.signal });
  }
  async recoverStaleTasks() {
    const repo = this.repo;
    const stale = await repo.find({ filter: { status: ["pending", "running"] } });
    for (const task of stale) {
      await repo.update({
        filter: { id: task.get("id") },
        values: { status: TASK_STATUS.FAILED, doneAt: /* @__PURE__ */ new Date(), message: "\u670D\u52A1\u91CD\u542F\u4E2D\u65AD" }
      });
    }
    if (stale.length) {
      this.plugin.app.logger.info(`[sjgl02] \u542F\u52A8\u6062\u590D\uFF1A${stale.length} \u4E2A\u6B8B\u7559\u4EFB\u52A1\u5DF2\u6807\u8BB0\u4E3A\u5931\u8D25\uFF08\u670D\u52A1\u91CD\u542F\u4E2D\u65AD\uFF09`);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TASK_CHANNEL,
  TASK_STATUS,
  TaskQueueService
});
