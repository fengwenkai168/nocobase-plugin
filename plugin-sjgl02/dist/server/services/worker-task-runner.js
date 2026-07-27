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
var worker_task_runner_exports = {};
__export(worker_task_runner_exports, {
  WorkerTaskRunner: () => WorkerTaskRunner
});
module.exports = __toCommonJS(worker_task_runner_exports);
var import_node_path = __toESM(require("node:path"));
var import_node_worker_threads = require("node:worker_threads");
const CANCEL_GRACE_MS = 3e4;
class WorkerTaskRunner {
  constructor(plugin) {
    this.plugin = plugin;
  }
  async run(taskId, signal) {
    var _a;
    const logger = this.plugin.app.logger;
    const isDev = (((_a = process.argv[1]) == null ? void 0 : _a.endsWith(".ts")) || process.argv[1].includes("tinypool")) ?? false;
    const appRoot = process.env.APP_PACKAGE_ROOT || "packages/core/app";
    const workerPath = import_node_path.default.resolve(process.cwd(), appRoot, isDev ? "src/index.ts" : "lib/index.js");
    logger.info(`[sjgl02] \u4EFB\u52A1 #${taskId} \u542F\u52A8 worker \u5B50\u8FDB\u7A0B\u6267\u884C\uFF08${isDev ? "dev" : "prod"} \u6A21\u5F0F\uFF09`);
    await new Promise((resolve, reject) => {
      let settled = false;
      const settle = (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };
      const worker = new import_node_worker_threads.Worker(workerPath, {
        execArgv: isDev ? ["--require", "tsx/cjs"] : [],
        workerData: { argv: ["sjgl02:run-task", `--taskId=${taskId}`] },
        env: { ...process.env, WORKER_MODE: "-" }
      });
      const onAbort = () => {
        worker.postMessage({ type: "cancel" });
        setTimeout(() => {
          worker.terminate();
        }, CANCEL_GRACE_MS).unref();
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
      worker.on("message", (message) => {
        if ((message == null ? void 0 : message.type) === "failure") {
          settle(new Error(message.error || "\u4EFB\u52A1\u6267\u884C\u5931\u8D25"));
        }
      });
      worker.on("error", (error) => settle(error));
      worker.on("exit", (code) => {
        logger.info(`[sjgl02] \u4EFB\u52A1 #${taskId} worker \u5DF2\u9000\u51FA\uFF0Ccode=${code}`);
        if (code !== 0 && !signal.aborted) {
          settle(new Error(`\u4EFB\u52A1\u6267\u884C\u8FDB\u7A0B\u5F02\u5E38\u9000\u51FA\uFF08code ${code}\uFF09`));
        } else {
          settle();
        }
      });
      worker.on("messageerror", (error) => settle(error));
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WorkerTaskRunner
});
