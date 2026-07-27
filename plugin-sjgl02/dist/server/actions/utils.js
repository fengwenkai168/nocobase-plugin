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
var utils_exports = {};
__export(utils_exports, {
  currentUserId: () => currentUserId
});
module.exports = __toCommonJS(utils_exports);
function currentUserId(ctx) {
  var _a, _b, _c, _d, _e;
  const c = ctx;
  return ((_b = (_a = c.auth) == null ? void 0 : _a.user) == null ? void 0 : _b.id) ?? ((_c = c.state) == null ? void 0 : _c.currentUserId) ?? ((_e = (_d = c.state) == null ? void 0 : _d.currentUser) == null ? void 0 : _e.id);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  currentUserId
});
