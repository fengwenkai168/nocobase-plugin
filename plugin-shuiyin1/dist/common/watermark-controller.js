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
var watermark_controller_exports = {};
__export(watermark_controller_exports, {
  createWatermarkController: () => createWatermarkController
});
module.exports = __toCommonJS(watermark_controller_exports);
var import_watermark_core = require("./watermark-core");
function createWatermarkController(request) {
  let settings = { ...import_watermark_core.defaultSettings };
  let user = {};
  let checkTimer;
  let timeTimer;
  let refreshTimer;
  let observer = null;
  let settingsChangedHandler = null;
  let popstateHandler = null;
  let origPushState = null;
  function clearTimeTimer() {
    if (timeTimer) {
      window.clearInterval(timeTimer);
      timeTimer = void 0;
    }
  }
  function startTimeTimer() {
    clearTimeTimer();
    timeTimer = window.setInterval(() => {
      (0, import_watermark_core.renderWatermark)(settings, user);
    }, 6e4);
  }
  async function fetchUser() {
    var _a;
    try {
      const res = await request({ url: "auth:check", method: "GET" });
      user = ((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.data) || {};
      (0, import_watermark_core.log)("[shuiyin1] user refreshed:", user.nickname || user.username);
    } catch (err) {
      (0, import_watermark_core.logWarn)("[shuiyin1] failed to fetch current user", err);
    }
  }
  async function fetchSettings() {
    var _a, _b, _c;
    try {
      (0, import_watermark_core.log)("[shuiyin1] fetching settings...");
      const res = await request({
        url: "shuiyin1_settings:list",
        method: "POST",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache"
        },
        data: { __refresh: Date.now() }
      });
      (0, import_watermark_core.log)("[shuiyin1] raw settings response:", res);
      const record = ((_b = (_a = res == null ? void 0 : res.data) == null ? void 0 : _a.data) == null ? void 0 : _b[0]) || ((_c = res == null ? void 0 : res.data) == null ? void 0 : _c[0]);
      if (record) {
        const parsed = {
          text: record.text ?? import_watermark_core.defaultSettings.text,
          textSources: Array.isArray(record.textSources) && record.textSources.length ? record.textSources : [...import_watermark_core.defaultSettings.textSources],
          opacity: record.opacity ?? import_watermark_core.defaultSettings.opacity,
          fontSize: record.fontSize ?? import_watermark_core.defaultSettings.fontSize,
          showTime: record.showTime ?? import_watermark_core.defaultSettings.showTime,
          density: record.density ?? import_watermark_core.defaultSettings.density,
          enabled: record.enabled ?? import_watermark_core.defaultSettings.enabled
        };
        (0, import_watermark_core.log)("[shuiyin1] parsed settings:", parsed);
        return parsed;
      }
      (0, import_watermark_core.logWarn)("[shuiyin1] no settings record found, using defaults");
    } catch (err) {
      (0, import_watermark_core.logWarn)("[shuiyin1] failed to fetch settings", err);
    }
    return { ...import_watermark_core.defaultSettings };
  }
  function startWatchers() {
    if (!checkTimer) {
      checkTimer = window.setInterval(() => {
        if (!document.getElementById(import_watermark_core.WATERMARK_ID)) {
          (0, import_watermark_core.renderWatermark)(settings, user);
        }
      }, 2e3);
    }
    if (!observer) {
      observer = new MutationObserver(() => {
        if (!document.getElementById(import_watermark_core.WATERMARK_ID)) {
          (0, import_watermark_core.renderWatermark)(settings, user);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  function stopWatchers() {
    if (checkTimer) {
      window.clearInterval(checkTimer);
      checkTimer = void 0;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
  function applyWatermark(next, reason) {
    if (!next.enabled) {
      clearTimeTimer();
      stopWatchers();
      const el = document.getElementById(import_watermark_core.WATERMARK_ID);
      if (el) el.remove();
      if (reason) (0, import_watermark_core.log)("[shuiyin1] watermark disabled, reason:", reason);
      return;
    }
    (0, import_watermark_core.renderWatermark)(next, user);
    startWatchers();
    clearTimeTimer();
    if (next.showTime) startTimeTimer();
  }
  async function refreshWatermark(reason, newSettings) {
    if ((0, import_watermark_core.isAuthPage)()) {
      clearTimeTimer();
      const el = document.getElementById(import_watermark_core.WATERMARK_ID);
      if (el) el.remove();
      return;
    }
    let next;
    if (newSettings) {
      next = { ...import_watermark_core.defaultSettings, ...newSettings };
    } else {
      await fetchUser();
      next = await fetchSettings();
    }
    settings = next;
    if (reason) (0, import_watermark_core.log)("[shuiyin1] watermark refreshed, reason:", reason, next);
    applyWatermark(next, reason);
  }
  function applyLatestSettings(next, reason) {
    settings = { ...import_watermark_core.defaultSettings, ...next };
    applyWatermark(settings, reason);
    (0, import_watermark_core.log)("[shuiyin1] watermark refreshed, reason:", reason, settings);
  }
  async function startup() {
    await fetchUser();
    (0, import_watermark_core.log)("[shuiyin1] plugin load started");
    settings = await fetchSettings();
    (0, import_watermark_core.log)("[shuiyin1] initial settings loaded:", settings);
    const initWatermark = () => {
      if (!document.body) {
        (0, import_watermark_core.log)("[shuiyin1] document.body not ready, waiting DOMContentLoaded");
        window.addEventListener("DOMContentLoaded", initWatermark, { once: true });
        return;
      }
      (0, import_watermark_core.log)("[shuiyin1] applying initial watermark with settings:", settings, "user:", user);
      if (settings.enabled) {
        (0, import_watermark_core.renderWatermark)(settings, user);
        startWatchers();
        if (settings.showTime) startTimeTimer();
      }
    };
    initWatermark();
    const handler = (e) => {
      const detail = e.detail;
      if (detail) {
        applyLatestSettings(detail, "settings changed");
      } else {
        refreshWatermark("settings changed");
      }
    };
    settingsChangedHandler = handler;
    window.addEventListener("shuiyin1:settings:changed", handler);
    refreshTimer = window.setInterval(() => {
      refreshWatermark("periodic refresh");
    }, 3e4);
  }
  function load() {
    if ((0, import_watermark_core.isAuthPage)()) {
      let initialized = false;
      const tryInit = () => {
        if (initialized) return;
        if (!(0, import_watermark_core.isAuthPage)()) {
          initialized = true;
          if (popstateHandler) {
            window.removeEventListener("popstate", popstateHandler);
            popstateHandler = null;
          }
          startup();
        }
      };
      popstateHandler = tryInit;
      window.addEventListener("popstate", tryInit);
      origPushState = history.pushState;
      const orig = origPushState;
      history.pushState = function(...args) {
        orig.apply(this, args);
        tryInit();
      };
      const frameCheck = () => {
        tryInit();
        if (!initialized) requestAnimationFrame(frameCheck);
      };
      requestAnimationFrame(frameCheck);
      return;
    }
    startup();
  }
  function cleanup() {
    stopWatchers();
    clearTimeTimer();
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = void 0;
    }
    if (settingsChangedHandler) {
      window.removeEventListener("shuiyin1:settings:changed", settingsChangedHandler);
      settingsChangedHandler = null;
    }
    if (popstateHandler) {
      window.removeEventListener("popstate", popstateHandler);
      popstateHandler = null;
    }
    if (origPushState) {
      history.pushState = origPushState;
      origPushState = null;
    }
    const el = document.getElementById(import_watermark_core.WATERMARK_ID);
    if (el) el.remove();
  }
  return { load, cleanup };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createWatermarkController
});
