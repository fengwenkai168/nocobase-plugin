import { cancelFlags } from './cancel-state';
import { writeTaskLog } from './taskLogs';
import {
  quoteIdentifier,
  resolveMappedDataColumns,
  isEmptyRow,
  makeRecord,
  buildSnapshot,
  applyBelongsToFK,
  convertRecordValues,
  insertBatch,
  insertWithSplit,
} from './import-utils';
import { streamProcessExcel } from './excel-parser';
import type { Database } from '@nocobase/database';

interface Phase1Result {
  passed: boolean;
  headers: string[];
  totalRows: number;
  errorLogs: any[];
}

export async function phase1Validate(
  db: Database,
  taskId: number,
  filePath: string,
  sheetName: string | undefined,
  hRow: number,
  mapping: Record<string, string>,
  custVals: Record<string, any>,
  uFields: string[],
  mode: string,
  pkColumns: string[],
): Promise<Phase1Result> {
  const repo = db.getRepository('sjgl02_tasks');
  await writeTaskLog(db, taskId, 'INFO', '阶段一：流式预校验开始...');
  const errorLogs: any[] = [];
  const seenUniqueValues = new Set<string>();
  const seenPkValues = new Set<string>();
  let cancelled = false;
  let headers: string[] = [];

  const result = await new Promise<{ passed: boolean; headers: string[]; totalRows: number }>((resolve, reject) => {
    streamProcessExcel(
      filePath,
      sheetName,
      hRow,
      async (rowNum, dataIdx, vals) => {
        if (cancelFlags.has(taskId)) {
          cancelled = true;
          return false;
        }
        if (dataIdx < 0) return true;
        if (isEmptyRow(vals, headers, mapping)) return true;

        const record = makeRecord(vals, headers, mapping, custVals);

        if ((mode === 'update' || mode === 'upsert') && uFields.length > 0) {
          const emptyUFields = uFields.filter(
            (uf) => record[uf] === undefined || record[uf] === '' || record[uf] === null,
          );
          if (emptyUFields.length > 0) {
            if (errorLogs.length < 1000) {
              errorLogs.push({
                row: dataIdx + 1,
                excelRow: rowNum,
                reason: '唯一值字段为空（' + emptyUFields.join(', ') + '）',
                snapshot: buildSnapshot(vals, headers, mapping, custVals),
              });
            }
          } else {
            const ufKey = uFields.map((uf) => record[uf]).join('||');
            if (seenUniqueValues.has(ufKey)) {
              if (errorLogs.length < 1000) {
                errorLogs.push({
                  row: dataIdx + 1,
                  excelRow: rowNum,
                  reason: 'Excel 内部唯一值重复: ' + uFields.join('+') + ' = ' + ufKey,
                  snapshot: buildSnapshot(vals, headers, mapping, custVals),
                });
              }
            } else {
              seenUniqueValues.add(ufKey);
            }
          }
        }

        for (const pk of pkColumns) {
          if (mapping[pk] && mapping[pk] !== '__ignore__') {
            const pkVal = record[pk];
            if (pkVal !== undefined && pkVal !== '' && pkVal !== null) {
              const pkKey = String(pkVal);
              if (seenPkValues.has(pkKey)) {
                if (errorLogs.length < 1000) {
                  errorLogs.push({
                    row: dataIdx + 1,
                    excelRow: rowNum,
                    reason: 'Excel 内部主键重复: ' + pk + ' = ' + pkKey,
                    snapshot: buildSnapshot(vals, headers, mapping, custVals),
                  });
                }
              } else {
                seenPkValues.add(pkKey);
              }
            }
          }
        }

        return true;
      },
      (h) => {
        headers = h;
      },
    )
      .then((r) => {
        resolve({
          passed: !cancelled && errorLogs.length === 0,
          headers: r.headers,
          totalRows: r.totalRows,
        });
      })
      .catch(reject);
  });

  if (cancelled) {
    await writeTaskLog(db, taskId, 'WARN', '任务已取消（阶段一）');
    await repo.update({ filterByTk: taskId, values: { status: 'cancelled', completedAt: new Date() } });
    return { passed: false, headers: result.headers, totalRows: result.totalRows, errorLogs };
  }

  await repo.update({ filterByTk: taskId, values: { totalRows: result.totalRows } });
  await writeTaskLog(db, taskId, 'SUCC', '阶段一预校验完成，共 ' + result.totalRows + ' 行有效数据');

  if (!result.passed) {
    await writeTaskLog(db, taskId, 'ERROR', '阶段一预校验失败，共 ' + errorLogs.length + ' 个错误');
    await repo.update({
      filterByTk: taskId,
      values: {
        status: 'failed',
        errorLogs,
        errorMessage: '预校验失败: ' + errorLogs.length + ' 个错误',
        completedAt: new Date(),
      },
    });
  }

  return { ...result, errorLogs };
}

export async function phase2WriteShadow(
  db: Database,
  taskId: number,
  filePath: string,
  sheetName: string | undefined,
  hRow: number,
  mapping: Record<string, string>,
  custVals: Record<string, any>,
  bCellMode: string,
  mode: string,
  uFields: string[],
  coll: any,
  pkColumns: string[],
  allColumns: string[],
  dataColumns: string[],
  shadowTableName: string,
  quotedMain: string,
  quotedShadow: string,
  transaction: any,
  phase1Headers: string[],
  phase1TotalRows: number,
  userId: number | null,
): Promise<{ phase2TotalRows: number; errorLogs: any[] }> {
  const repo = db.getRepository('sjgl02_tasks');
  const sequelize = db.sequelize;
  await writeTaskLog(db, taskId, 'INFO', '阶段二：影子表写入开始...');

  const BATCH_SIZE = Math.max(1, Math.min(2000, Math.floor(30000 / dataColumns.length)));
  const quotedCols = dataColumns.map((c) => quoteIdentifier(c)).join(', ');

  let batch: any[][] = [];
  let phase2Processed = 0;
  let phase2Cancelled = false;
  const phase2ErrorLogs: any[] = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;
    try {
      await insertBatch(sequelize, quotedShadow, quotedCols, dataColumns, batch, transaction);
    } catch (batchErr: any) {
      await writeTaskLog(
        db,
        taskId,
        'WARN',
        '批次写入失败：' + (batchErr.message || String(batchErr)) + '，逐行定位...',
      );
      const splitLogs = await insertWithSplit(
        sequelize,
        quotedShadow,
        quotedCols,
        dataColumns,
        batch,
        phase2Processed - batch.length,
        transaction,
      );
      if (splitLogs.length > 0) {
        phase2ErrorLogs.push(...splitLogs);
        if (phase2ErrorLogs.length > 1000) phase2ErrorLogs.splice(1000);
        throw new Error(splitLogs.length + ' 行写入失败');
      }
    }
    batch = [];
  };

  await new Promise<void>((resolve, reject) => {
    streamProcessExcel(
      filePath,
      sheetName,
      hRow,
      async (rowNum, dataIdx, vals) => {
        if (cancelFlags.has(taskId)) {
          phase2Cancelled = true;
          return false;
        }
        if (dataIdx < 0) return true;
        if (isEmptyRow(vals, phase1Headers, mapping)) return true;

        const record = makeRecord(vals, phase1Headers, mapping, custVals);
        applyBelongsToFK(record, phase1Headers, vals, mapping, coll);

        const converted = convertRecordValues(record, coll);
        const rowVals = dataColumns.map((c) => (converted[c] !== undefined ? converted[c] : null));
        batch.push(rowVals);
        phase2Processed++;

        if (batch.length >= BATCH_SIZE) {
          try {
            await flushBatch();
          } catch (e) {
            reject(e);
            return false;
          }
          const prog = 50 + Math.floor((phase2Processed / Math.max(phase1TotalRows, 1)) * 40);
          try {
            await repo.update({
              filterByTk: taskId,
              values: { progress: Math.min(90, prog), processedRows: phase2Processed },
            });
          } catch {
            /* 忽略 */
          }
        }

        if (phase2Processed % 1000 === 0 && cancelFlags.has(taskId)) {
          phase2Cancelled = true;
          return false;
        }
        return true;
      },
      (headers) => {
        if (phase1Headers.length === 0) phase1Headers = headers;
      },
    )
      .then(async () => {
        try {
          await flushBatch();
          resolve();
        } catch (e) {
          reject(e);
        }
      })
      .catch(reject);
  });

  if (phase2Cancelled || cancelFlags.has(taskId)) {
    await sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow, { transaction });
    await transaction.commit();
    await writeTaskLog(db, taskId, 'WARN', '任务已取消（阶段二）');
    await repo.update({ filterByTk: taskId, values: { status: 'cancelled', completedAt: new Date() } });
    return { phase2TotalRows: 0, errorLogs: [] };
  }

  if (phase2ErrorLogs.length > 0) {
    await sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow, { transaction });
    await transaction.commit();
    for (let i = 0; i < Math.min(10, phase2ErrorLogs.length); i++) {
      const log = phase2ErrorLogs[i];
      await writeTaskLog(
        db,
        taskId,
        'ERROR',
        '第 ' + (log.row || i + 1) + ' 行写入失败：' + log.reason + '，快照：' + (log.snapshot || '{}'),
      );
    }
    await writeTaskLog(db, taskId, 'ERROR', '阶段二写入失败，共 ' + phase2ErrorLogs.length + ' 个错误');
    await repo.update({
      filterByTk: taskId,
      values: {
        status: 'failed',
        errorLogs: phase2ErrorLogs,
        errorMessage: '阶段二写入失败: ' + phase2ErrorLogs.length + ' 行数据异常',
        completedAt: new Date(),
      },
    });
    return { phase2TotalRows: 0, errorLogs: phase2ErrorLogs };
  }

  const phase2TotalRows = phase2Processed;
  await writeTaskLog(db, taskId, 'SUCC', '阶段二影子表写入完成，共 ' + phase2TotalRows + ' 行');
  await repo.update({ filterByTk: taskId, values: { progress: 90, processedRows: phase2TotalRows } });

  return { phase2TotalRows, errorLogs: [] };
}
