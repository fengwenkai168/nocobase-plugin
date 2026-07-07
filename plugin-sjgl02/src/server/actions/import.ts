/**
 * 导入模块聚合导出
 * 原 import.ts 已拆分为以下文件：
 * - import-utils.ts: 工具函数（quoteIdentifier、convertValue 等）
 * - excel-parser.ts: Excel 流式解析
 * - import-actions.ts: HTTP action 函数
 * - import-service.ts: 核心执行逻辑
 * - import-phases.ts: 阶段一、二处理
 * - import-phase3.ts: 阶段三原子迁移
 */

export {
  quoteIdentifier,
  resolveAttachmentFilePath,
  getPrimaryKeyColumns,
  prepareShadowPrimaryKey,
  dropShadowNotNull,
  resolveMappedDataColumns,
  validateCollectionName,
  getAllowedFieldNames,
  getFieldType,
  normalizeDateValue,
  convertValue,
  convertRecordValues,
  applyBelongsToFK,
  makeRecord,
  buildSnapshot,
  isEmptyRow,
  insertBatch,
  insertWithSplit,
  type ImportAsyncParams,
} from './import-utils';

export { streamProcessExcel } from './excel-parser';

export { getTableFields, autoMatch, uploadParse, preview, executeImport } from './import-actions';

export { processImportAsync } from './import-service';
