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
var watermark_core_exports = {};
__export(watermark_core_exports, {
  WATERMARK_ID: () => WATERMARK_ID,
  authPages: () => authPages,
  defaultSettings: () => defaultSettings,
  densityMap: () => densityMap,
  isAuthPage: () => isAuthPage,
  log: () => log,
  logWarn: () => logWarn,
  renderWatermark: () => renderWatermark
});
module.exports = __toCommonJS(watermark_core_exports);
const DEBUG = false;
const WATERMARK_ID = "shuiyin1-watermark-overlay";
const defaultSettings = {
  text: "",
  opacity: 0.15,
  fontSize: 10,
  showTime: true,
  density: 5,
  enabled: true
};
const authPages = [
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password"
];
function isAuthPage() {
  const path = window.location.pathname;
  return authPages.some((p) => path === p || path.startsWith(p + "/"));
}
const densityMap = {
  1: { width: 400, height: 280 },
  2: { width: 320, height: 220 },
  3: { width: 240, height: 160 },
  4: { width: 180, height: 120 },
  5: { width: 140, height: 90 }
};
function renderWatermark(settings, username) {
  const el = document.getElementById(WATERMARK_ID);
  if (isAuthPage()) {
    if (el) el.remove();
    return;
  }
  if (!settings.enabled) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    const div = document.createElement("div");
    div.id = WATERMARK_ID;
    Object.assign(div.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "999999",
      backgroundRepeat: "repeat",
      opacity: "1"
    });
    document.body.appendChild(div);
  }
  const container = document.getElementById(WATERMARK_ID);
  if (!container) return;
  const text = settings.text || username;
  const displayText = settings.showTime ? `${text} ${(/* @__PURE__ */ new Date()).getFullYear()}-${String((/* @__PURE__ */ new Date()).getMonth() + 1).padStart(2, "0")}-${String((/* @__PURE__ */ new Date()).getDate()).padStart(2, "0")} ${String((/* @__PURE__ */ new Date()).getHours()).padStart(2, "0")}:${String((/* @__PURE__ */ new Date()).getMinutes()).padStart(2, "0")}` : text;
  const { width, height } = densityMap[settings.density] || densityMap[5];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = settings.opacity;
  ctx.font = `${settings.fontSize}px sans-serif`;
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillText(displayText, 0, 0);
  ctx.restore();
  container.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
}
function log(...args) {
  if (DEBUG) console.log(...args);
}
function logWarn(...args) {
  if (DEBUG) console.warn(...args);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WATERMARK_ID,
  authPages,
  defaultSettings,
  densityMap,
  isAuthPage,
  log,
  logWarn,
  renderWatermark
});
