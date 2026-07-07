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
var import_exports = {};
__export(import_exports, {
  applyBelongsToFK: () => import_import_utils.applyBelongsToFK,
  autoMatch: () => import_import_actions.autoMatch,
  buildSnapshot: () => import_import_utils.buildSnapshot,
  convertRecordValues: () => import_import_utils.convertRecordValues,
  convertValue: () => import_import_utils.convertValue,
  dropShadowNotNull: () => import_import_utils.dropShadowNotNull,
  executeImport: () => import_import_actions.executeImport,
  getAllowedFieldNames: () => import_import_utils.getAllowedFieldNames,
  getFieldType: () => import_import_utils.getFieldType,
  getPrimaryKeyColumns: () => import_import_utils.getPrimaryKeyColumns,
  getTableFields: () => import_import_actions.getTableFields,
  insertBatch: () => import_import_utils.insertBatch,
  insertWithSplit: () => import_import_utils.insertWithSplit,
  isEmptyRow: () => import_import_utils.isEmptyRow,
  makeRecord: () => import_import_utils.makeRecord,
  normalizeDateValue: () => import_import_utils.normalizeDateValue,
  prepareShadowPrimaryKey: () => import_import_utils.prepareShadowPrimaryKey,
  preview: () => import_import_actions.preview,
  processImportAsync: () => import_import_service.processImportAsync,
  quoteIdentifier: () => import_import_utils.quoteIdentifier,
  resolveAttachmentFilePath: () => import_import_utils.resolveAttachmentFilePath,
  resolveMappedDataColumns: () => import_import_utils.resolveMappedDataColumns,
  streamProcessExcel: () => import_excel_parser.streamProcessExcel,
  uploadParse: () => import_import_actions.uploadParse,
  validateCollectionName: () => import_import_utils.validateCollectionName
});
module.exports = __toCommonJS(import_exports);
var import_import_utils = require("./import-utils");
var import_excel_parser = require("./excel-parser");
var import_import_actions = require("./import-actions");
var import_import_service = require("./import-service");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyBelongsToFK,
  autoMatch,
  buildSnapshot,
  convertRecordValues,
  convertValue,
  dropShadowNotNull,
  executeImport,
  getAllowedFieldNames,
  getFieldType,
  getPrimaryKeyColumns,
  getTableFields,
  insertBatch,
  insertWithSplit,
  isEmptyRow,
  makeRecord,
  normalizeDateValue,
  prepareShadowPrimaryKey,
  preview,
  processImportAsync,
  quoteIdentifier,
  resolveAttachmentFilePath,
  resolveMappedDataColumns,
  streamProcessExcel,
  uploadParse,
  validateCollectionName
});
