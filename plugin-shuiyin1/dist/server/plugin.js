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
var plugin_exports = {};
__export(plugin_exports, {
  PluginShuiyin1Server: () => PluginShuiyin1Server,
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);
var import_server = require("@nocobase/server");
var import_path = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
class PluginShuiyin1Server extends import_server.Plugin {
  async afterAdd() {
  }
  async beforeLoad() {
  }
  async load() {
    console.log("[shuiyin1] load() started", { name: this.name, options: this.options });
    this.app.acl.allow("shuiyin1_settings", "*", "loggedIn");
    await this.syncVersion();
    this.app.use(async (ctx, next) => {
      if (ctx.path === "/api/plugins/@my-project/plugin-shuiyin1/readme") {
        const readmePath = import_path.default.resolve(__dirname, "../../README.md");
        try {
          const content = import_fs.default.readFileSync(readmePath, "utf8");
          ctx.body = `<!DOCTYPE html><html><head><meta charset="utf8"><title>\u6C34\u5370\u63D2\u4EF6\u8BF4\u660E</title><style>body{max-width:800px;margin:0 auto;padding:20px;font-family:sans-serif;line-height:1.6}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}pre{background:#f4f4f4;padding:15px;border-radius:5px;overflow-x:auto}h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:8px}</style></head><body><pre style="background:none;padding:0;white-space:pre-wrap;word-wrap:break-word">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`;
          ctx.type = "text/html; charset=utf8";
        } catch {
          ctx.status = 404;
          ctx.body = "README not found";
        }
        return;
      }
      await next();
    });
  }
  async install() {
    await this.createDefaultSettings();
  }
  async upgrade() {
    this.app.log.info("[shuiyin1] running upgrade");
    await this.syncVersion();
    await this.migrateEnabledField();
  }
  async migrateEnabledField() {
    const repo = this.db.getRepository("shuiyin1_settings");
    const records = await repo.find();
    for (const record of records) {
      if (record.get("enabled") === void 0 || record.get("enabled") === null) {
        record.set("enabled", true);
        await record.save();
        this.app.log.info("[shuiyin1] migrated enabled field for record", record.get("id"));
      }
    }
  }
  async syncVersion() {
    var _a, _b;
    try {
      const packageName = ((_a = this.options) == null ? void 0 : _a.packageName) || "@my-project/plugin-shuiyin1";
      const pkg = this.readPackageJson();
      console.log("[shuiyin1] syncVersion", { packageName, version: pkg == null ? void 0 : pkg.version, dirname: __dirname });
      if (!(pkg == null ? void 0 : pkg.version)) {
        console.log("[shuiyin1] syncVersion: cannot read package.json");
        return;
      }
      const repo = (_b = this.app.pm) == null ? void 0 : _b.repository;
      if (!repo) {
        console.log("[shuiyin1] syncVersion: no repository");
        return;
      }
      const item = await repo.findOne({ filter: { packageName } });
      if (!item) {
        console.log("[shuiyin1] syncVersion: no item in _plugins table");
        return;
      }
      const dbVersion = item.get("version");
      console.log("[shuiyin1] syncVersion", { dbVersion, pkgVersion: pkg.version });
      if (dbVersion !== pkg.version) {
        item.set("version", pkg.version);
        await item.save();
        console.log("[shuiyin1] version synced from", dbVersion, "to", pkg.version);
      }
    } catch (err) {
      console.log("[shuiyin1] syncVersion error:", err == null ? void 0 : err.message);
    }
  }
  readPackageJson() {
    const candidates = [
      import_path.default.resolve(__dirname, "../../package.json"),
      import_path.default.resolve(__dirname, "../../../package.json")
    ];
    for (const p of candidates) {
      try {
        if (import_fs.default.existsSync(p)) {
          return JSON.parse(import_fs.default.readFileSync(p, "utf8"));
        }
      } catch {
      }
    }
    console.log("[shuiyin1] package.json not found in:", candidates);
    return null;
  }
  async createDefaultSettings() {
    const repo = this.db.getRepository("shuiyin1_settings");
    const count = await repo.count();
    if (count === 0) {
      await repo.create({
        values: {
          text: "",
          opacity: 0.15,
          fontSize: 10,
          showTime: true,
          density: 5,
          enabled: true
        }
      });
    }
  }
  async afterEnable() {
  }
  async afterDisable() {
  }
  async remove() {
  }
}
var plugin_default = PluginShuiyin1Server;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PluginShuiyin1Server
});
