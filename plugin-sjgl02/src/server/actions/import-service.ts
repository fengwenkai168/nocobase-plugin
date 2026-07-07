import fs from 'fs';
import { cancelFlags } from './cancel-state';
import { writeTaskLog } from './taskLogs';
import {
  quoteIdentifier,
  resolveAttachmentFilePath,
  getPrimaryKeyColumns,
  dropShadowNotNull,
  resolveMappedDataColumns,
  validateCollectionName,
  getAllowedFieldNames,
  insertBatch,
  insertWithSplit,
  type ImportAsyncParams,
} from './import-utils';
import type { Database } from '@nocobase/database';
import { phase1Validate, phase2WriteShadow } from './import-phases';
import { phase3Migrate } from './import-phase3';

export async function processImportAsync(db: Database, taskId: number, params: ImportAsyncParams) {
  const {
    tableName,
    sheetName,
    headerRow,
    fieldMapping,
    customValues,
    importMode,
    uniqueFields,
    blankCellMode,
    fileId,
  } = params;
  const repo = db.getRepository('sjgl02_tasks');
  const sequelize = db.sequelize;

  try {
    await sequelize.query("SET SESSION statement_timeout = '5min'");
  } catch {
    /* 忽略 */
  }

  const TIMEOUT_MS = 30 * 60 * 1000;
  const safetyTimer = setTimeout(async () => {
    cancelFlags.add(taskId);
    try {
      await repo.update({
        filterByTk: taskId,
        values: { status: 'timeout', errorMessage: '导入执行超时', completedAt: new Date() },
      });
    } catch {
      /* 忽略 */
    }
  }, TIMEOUT_MS);

  let userId: number | null = null;
  try {
    const taskRec = await repo.findOne({ filter: { id: taskId }, raw: true });
    userId = (taskRec as any)?.createdById ?? null;
  } catch {
    /* 忽略 */
  }

  const mapping = fieldMapping || {};
  const custVals = customValues || {};
  const uFields = uniqueFields || [];
  const hRow = parseInt(String(headerRow), 10) || 1;
  const bCellMode = blankCellMode || 'update';
  const mode = importMode || 'insert';

  let coll: any;
  try {
    coll = validateCollectionName(db, tableName);
  } catch (err: any) {
    await fail(taskId, db, '数据表不存在: ' + err.message);
    return;
  }

  const allowedFieldSet = getAllowedFieldNames(coll);
  for (const key of Object.keys(mapping)) {
    if (!allowedFieldSet.has(key)) {
      await fail(taskId, db, '字段 ' + key + ' 不存在于数据表 ' + tableName);
      return;
    }
  }
  for (const uf of uFields) {
    if (!allowedFieldSet.has(uf)) {
      await fail(taskId, db, '唯一值字段 ' + uf + ' 不存在');
      return;
    }
  }

  let filePath = '';
  try {
    const attachRepo = db.getRepository('attachments');
    const attachment = await attachRepo.findOne({ filter: { id: fileId } });
    if (!attachment) {
      await fail(taskId, db, '附件记录未找到: ' + fileId);
      return;
    }
    filePath = await resolveAttachmentFilePath(db, attachment);
  } catch (err: any) {
    await fail(taskId, db, '解析文件路径失败: ' + (err.message || String(err)));
    return;
  }
  if (!fs.existsSync(filePath)) {
    await fail(taskId, db, '文件未找到: ' + filePath);
    return;
  }

  let shadowTableName = '';
  const errorLogs: any[] = [];

  try {
    await repo.update({ filterByTk: taskId, values: { status: 'processing' } });
    await writeTaskLog(db, taskId, 'INFO', '开始执行导入任务');
    await writeTaskLog(db, taskId, 'INFO', '目标数据表: ' + tableName);
    await writeTaskLog(db, taskId, 'INFO', '导入模式: ' + mode);

    const pkColumns = await getPrimaryKeyColumns(sequelize, tableName);
    if (pkColumns.length === 0) {
      throw new Error('数据表 ' + tableName + ' 没有主键，无法导入');
    }

    const phase1Result = await phase1Validate(
      db,
      taskId,
      filePath,
      sheetName,
      hRow,
      mapping,
      custVals,
      uFields,
      mode,
      pkColumns,
    );

    if (!phase1Result.passed) {
      return;
    }

    shadowTableName = '_sjgl02_import_' + taskId;
    const quotedMain = quoteIdentifier(tableName);
    const quotedShadow = quoteIdentifier(shadowTableName);

    const transaction = await sequelize.transaction();

    try {
      await sequelize.query(
        'CREATE TABLE ' +
          quotedShadow +
          ' ( LIKE ' +
          quotedMain +
          ' INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS )',
        { transaction },
      );

      const [colRows] = await sequelize.query(
        'SELECT column_name FROM information_schema.columns WHERE table_name = :shadowTable AND table_schema = current_schema() ORDER BY ordinal_position',
        { replacements: { shadowTable: shadowTableName }, raw: true, transaction },
      );
      const allColumns = (colRows as any[]).map((r: any) => r.column_name);
      await sequelize.query('ALTER TABLE ' + quotedShadow + ' ADD COLUMN __import_row_id__ BIGSERIAL PRIMARY KEY', {
        transaction,
      });
      const autoSystemFields = allColumns.filter((c) =>
        ['id', 'createdAt', 'updatedAt', 'createdById', 'updatedById'].includes(c),
      );
      await dropShadowNotNull(sequelize, shadowTableName, autoSystemFields, transaction);
      const dataColumns = resolveMappedDataColumns(allColumns, mapping, coll, pkColumns);
      if (dataColumns.length === 0) {
        throw new Error('没有可导入的字段');
      }

      await writeTaskLog(db, taskId, 'INFO', '影子表列: ' + dataColumns.join(', ') + '，主键: ' + pkColumns.join(', '));

      const phase2Result = await phase2WriteShadow(
        db,
        taskId,
        filePath,
        sheetName,
        hRow,
        mapping,
        custVals,
        bCellMode,
        mode,
        uFields,
        coll,
        pkColumns,
        allColumns,
        dataColumns,
        shadowTableName,
        quotedMain,
        quotedShadow,
        transaction,
        phase1Result.headers,
        phase1Result.totalRows,
        userId,
      );

      if (phase2Result.errorLogs.length > 0) {
        return;
      }

      if (cancelFlags.has(taskId)) {
        await writeTaskLog(db, taskId, 'WARN', '任务已取消（阶段二完成后检测到取消信号）');
        return;
      }

      await phase3Migrate(
        db,
        taskId,
        mapping,
        bCellMode,
        mode,
        uFields,
        coll,
        pkColumns,
        allColumns,
        dataColumns,
        shadowTableName,
        quotedMain,
        quotedShadow,
        transaction,
        phase2Result.phase2TotalRows,
        userId,
      );
    } catch (phaseErr: any) {
      try {
        await transaction.rollback();
      } catch {
        /* 忽略 */
      }
      try {
        await sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow);
      } catch {
        /* 忽略 */
      }
      throw phaseErr;
    }
  } catch (err: any) {
    try {
      const fallbackLogs =
        errorLogs.length > 0
          ? errorLogs
          : [
              {
                row: 0,
                excelRow: 0,
                reason: err.message || String(err),
                snapshot: 'shadowTable=' + (shadowTableName || '?') + ', mode=' + mode + ', phase=阶段三',
              },
            ];
      await writeTaskLog(
        db,
        taskId,
        'ERROR',
        '导入失败(' + mode + '模式, 表' + tableName + '): ' + (err.message || String(err)),
      );
      const existingTask = await repo.findOne({ filterByTk: taskId, fields: ['status'] }).catch(() => null);
      const currentStatus = (existingTask as any)?.status;
      if (currentStatus !== 'timeout' && currentStatus !== 'cancelled') {
        await repo.update({
          filterByTk: taskId,
          values: {
            status: 'failed',
            errorMessage: err.message || String(err),
            errorLogs: fallbackLogs,
            completedAt: new Date(),
          },
        });
      }
    } catch {
      /* 忽略 */
    }
  } finally {
    clearTimeout(safetyTimer);
    cancelFlags.delete(taskId);
  }
}

export { insertBatch, insertWithSplit } from './import-utils';

async function fail(taskId: number, db: Database, message: string) {
  try {
    const repo = db.getRepository('sjgl02_tasks');
    await writeTaskLog(db, taskId, 'ERROR', message);
    await repo.update({
      filterByTk: taskId,
      values: { status: 'failed', errorMessage: message, completedAt: new Date() },
    });
  } catch {
    /* 忽略 */
  }
}
