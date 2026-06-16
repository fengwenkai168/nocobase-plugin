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
  PluginShuiyin1Server: () => PluginShuiyin1Server,
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);
var import_server = require("@nocobase/server");
class PluginShuiyin1Server extends import_server.Plugin {
  async afterAdd() {
  }
  async beforeLoad() {
  }
  async load() {
    this.app.acl.allow("shuiyin1_settings", "*", "loggedIn");
  }
  async install() {
    const repo = this.db.getRepository("shuiyin1_settings");
    const count = await repo.count();
    if (count === 0) {
      await repo.create({
        values: {
          text: "",
          opacity: 0.15,
          fontSize: 10,
          showTime: true,
          density: 5
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
