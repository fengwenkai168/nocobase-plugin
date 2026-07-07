import type { Database } from '@nocobase/database';
import { activeWorkers, forkExportWorker, killWorker } from './worker-manager';
import {
  getScalarFieldNames,
  getRelationFieldNames,
  getFieldDisplayName,
  getCollDisplayName,
  detectPkStrategy,
  resolveTempDir,
  getFieldMetas,
  getAssociationSheetConfigs,
} from './worker-utils';
import { cancelFlags } from '../actions/cancel-state';

const SCAN_INTERVAL = 30000;
const MAX_TASK_DURATION = 30 * 60 * 1000;

/** 导入任务的启动时间：taskId → Date.now() */
export const importTimers = new Map<number, number>();

let storedDb: Database | null = null;

// === Export 调度器 ===
let exportInterval: ReturnType<typeof setInterval> | null = null;
let isExportScheduling = false;

const runExportSchedule = async () => {
  if (!storedDb) return;
  if (isExportScheduling) return;
  isExportScheduling = true;
  const db = storedDb;
  const repo = db.getRepository('sjgl02_tasks');
  try {
    // 僵尸检测：将超过 30 分钟无更新的 processing 导出任务标记为 failed
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const stuckTasks = (await repo.find({
      filter: { taskType: 'export', status: 'processing', updatedAt: { $lt: stuckThreshold } },
      fields: ['id'],
      raw: true,
    })) as any[];
    if (stuckTasks.length > 0) {
      for (const t of stuckTasks) {
        await repo
          .update({
            filterByTk: (t as any).id,
            values: { status: 'failed', errorMessage: '任务超时：子进程无响应（僵尸检测）', completedAt: new Date() },
          })
          .catch(() => {});
      }
    }

    const processingCount = await repo.count({ filter: { taskType: 'export', status: 'processing' } });
    if (processingCount > 0) return;

    const [nextExport] = (await repo.find({
      filter: { taskType: 'export', status: 'pending' },
      sort: ['id'],
      limit: 1,
      raw: true,
    })) as any[];
    if (!nextExport) return;

    const taskId = (nextExport as any).id;
    const rec = nextExport as any;
    const headerStyle = rec.headerStyle || 'title_id';
    const includeAttachments = rec.includeAttachments || false;

    if (rec.tableName === '__all__') {
      const tableListConfig: { tableName: string; fields: string[] }[] = rec.selectedFields || [];
      if (tableListConfig.length === 0) {
        await repo.update({
          filterByTk: taskId,
          values: { status: 'failed', errorMessage: '没有可导出的表', completedAt: new Date() },
        });
        return;
      }

      const tableList = [];
      for (const cfg of tableListConfig) {
        const c = db.getCollection(cfg.tableName);
        if (!c) continue;
        let fn = cfg.fields?.length > 0 ? cfg.fields : getScalarFieldNames(c);
        if (!fn?.length) {
          const bel = getRelationFieldNames(c, ['belongsTo']);
          fn = bel.length > 0 ? bel : getRelationFieldNames(c, ['hasOne', 'hasMany', 'belongsToMany']);
        }
        if (!fn?.length) continue;
        const fh: Record<string, string> = {};
        for (const f of fn) fh[f] = getFieldDisplayName(c, f, headerStyle);
        const pkInfo = detectPkStrategy(c);
        let ct = 0;
        try {
          const r = db.getRepository(cfg.tableName);
          if (r) ct = await r.count({ filter: {} });
        } catch {
          /* 忽略 */
        }
        tableList.push({
          tableName: cfg.tableName,
          fieldNames: fn,
          fieldHeaders: fh,
          collDisplayName: getCollDisplayName(c, headerStyle),
          pkStrategy: pkInfo.strategy,
          pkField: pkInfo.pkField,
          collectionTotal: ct,
        });
      }

      if (tableList.length === 0) {
        await repo.update({
          filterByTk: taskId,
          values: { status: 'failed', errorMessage: '没有可导出的表（全部表不存在或无字段）', completedAt: new Date() },
        });
        return;
      }

      const totalRows = tableList.reduce((s, t) => s + t.collectionTotal, 0);
      await repo.update({
        filterByTk: taskId,
        values: { status: 'processing', totalRows, startedAt: new Date() },
      });

      const startMsg = {
        type: 'start' as const,
        taskId,
        tableName: '__all__',
        fieldNames: [],
        filter: {},
        headerStyle,
        pkStrategy: 'cursor' as const,
        pkField: null,
        collectionTotal: totalRows,
        includeAttachments,
        attachmentFieldNames: [],
        fileIdFieldNames: [],
        fieldHeaders: {},
        collDisplayName: '全部数据表',
        tempDir: resolveTempDir(),
        fileNameTemplate: rec.fileNameTemplate || '',
        tableList,
      };
      forkExportWorker(taskId, startMsg, repo, storedDb);
      return;
    }

    // 单表导出
    const coll = db.getCollection(rec.tableName);
    if (!coll) {
      await repo.update({
        filterByTk: taskId,
        values: { status: 'failed', errorMessage: `表 ${rec.tableName} 不存在`, completedAt: new Date() },
      });
      return;
    }

    const selectedFields = rec.selectedFields || [];
    let fieldNames = selectedFields.length > 0 ? selectedFields : getScalarFieldNames(coll);
    if (!fieldNames?.length) {
      const belongsToFields = getRelationFieldNames(coll, ['belongsTo']);
      if (belongsToFields.length > 0) {
        fieldNames = belongsToFields;
      } else {
        fieldNames = getRelationFieldNames(coll, ['hasOne', 'hasMany', 'belongsToMany']);
      }
    }
    if (!fieldNames?.length) {
      await repo.update({
        filterByTk: taskId,
        values: { status: 'failed', errorMessage: '没有可导出的字段', completedAt: new Date() },
      });
      return;
    }

    const fieldMetas = getFieldMetas(coll, fieldNames);
    const scalarFieldNames = fieldMetas.filter((m) => m.isScalar).map((m) => m.name);

    const fieldHeaders: Record<string, string> = {};
    for (const f of fieldNames) {
      fieldHeaders[f] = getFieldDisplayName(coll, f, headerStyle);
    }

    const pkInfo = detectPkStrategy(coll);
    const pkStrategy = pkInfo.strategy;
    const pkField = pkInfo.pkField;

    let collectionTotal = 0;
    try {
      const tRepo = db.getRepository(rec.tableName);
      if (tRepo) collectionTotal = await tRepo.count({ filter: {} });
    } catch {
      /* 忽略 */
    }

    const associationSheetTables = rec.associationSheetTables || [];
    const associationSheets =
      rec.includeAssociationSheet && associationSheetTables.length > 0
        ? getAssociationSheetConfigs(db, coll, fieldNames, associationSheetTables, headerStyle)
        : [];

    const collDisplayName = getCollDisplayName(coll, headerStyle);

    await repo.update({
      filterByTk: taskId,
      values: { status: 'processing', totalRows: rec.totalRows || collectionTotal, startedAt: new Date() },
    });

    const startMsg = {
      type: 'start' as const,
      taskId,
      tableName: rec.tableName,
      fieldNames,
      selectedFields,
      filter: {},
      headerStyle,
      pkStrategy,
      pkField,
      collectionTotal,
      includeAttachments,
      fieldMetas,
      includeAssociationSheet: rec.includeAssociationSheet || false,
      associationSheetTables,
      associationSheets,
      fieldHeaders,
      collDisplayName,
      tempDir: resolveTempDir(),
      fileNameTemplate: rec.fileNameTemplate || '',
    };

    forkExportWorker(taskId, startMsg, repo, storedDb);
  } catch {
    /* 忽略 */
  } finally {
    isExportScheduling = false;
  }
};

// === Import 调度器 ===
let importInterval: ReturnType<typeof setInterval> | null = null;
let importTimeoutCheckInterval: ReturnType<typeof setInterval> | null = null;
let isImportScheduling = false;

const runImportSchedule = async () => {
  if (!storedDb) return;
  if (isImportScheduling) return;
  isImportScheduling = true;
  const db = storedDb;
  const repo = db.getRepository('sjgl02_tasks');
  try {
    // 僵尸检测：将超过 30 分钟无更新的 processing 导入任务标记为 failed
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const importStuckTasks = (await repo.find({
      filter: { taskType: 'import', status: 'processing', updatedAt: { $lt: stuckThreshold } },
      fields: ['id'],
      raw: true,
    })) as any[];
    if (importStuckTasks.length > 0) {
      for (const t of importStuckTasks) {
        importTimers.delete((t as any).id);
        await repo
          .update({
            filterByTk: (t as any).id,
            values: { status: 'failed', errorMessage: '任务超时：导入进程无响应（僵尸检测）', completedAt: new Date() },
          })
          .catch(() => {});
      }
    }

    const importProcessingCount = await repo.count({ filter: { taskType: 'import', status: 'processing' } });
    if (importProcessingCount > 0) return;

    // 注意：这里是防御性检查，正常执行的 import 任务不应由调度器创建
    const nextImport = await repo.findOne({
      filter: { taskType: 'import', status: 'pending' },
      sort: ['id'],
    });
    if (!nextImport) return;

    const taskId = (nextImport as any).id;
    const rec = nextImport as any;

    if (!rec.tableName || !rec.importFileId) {
      await repo.update({
        filterByTk: taskId,
        values: {
          status: 'failed',
          errorMessage: `导入任务数据不完整: tableName=${rec.tableName}, importFileId=${rec.importFileId}`,
          completedAt: new Date(),
        },
      });
      return;
    }

    await repo.update({ filterByTk: taskId, values: { status: 'processing', startedAt: new Date() } });
    importTimers.set(taskId, Date.now());

    setImmediate(async () => {
      try {
        const { processImportAsync } = await import('../actions/import');
        const rec = nextImport as any;
        await processImportAsync(db, taskId, {
          tableName: rec.tableName,
          fileId: rec.importFileId,
          sheetName: rec.sheetName,
          headerRow: rec.headerRow,
          fieldMapping: rec.fieldMapping || {},
          customValues: rec.customValues || {},
          importMode: rec.importMode,
          uniqueFields: rec.uniqueFields || [],
          blankCellMode: rec.blankCellMode,
        });
      } catch {
        /* 已在 processImportAsync 内部处理 */
      } finally {
        importTimers.delete(taskId);
      }
    });
  } catch {
    /* 忽略 */
  } finally {
    isImportScheduling = false;
  }
};

// === Import 超时检查（独立，不参与调度竞争）===
const runImportTimeoutCheck = async () => {
  if (!storedDb) return;
  for (const [tid, started] of importTimers) {
    if (Date.now() - started > MAX_TASK_DURATION) {
      try {
        cancelFlags.add(tid);
        const t = await storedDb.getRepository('sjgl02_tasks').findOne({ filterByTk: tid, fields: ['status'] });
        if (t && (t as any)?.status === 'processing') {
          await storedDb.getRepository('sjgl02_tasks').update({
            filterByTk: tid,
            values: { status: 'timeout', errorMessage: '任务执行超时', completedAt: new Date() },
          });
        }
      } catch {
        /* 忽略 */
      }
      importTimers.delete(tid);
    }
  }
};

export function startSerialScheduler(db: Database): void {
  storedDb = db;

  if (!exportInterval) {
    exportInterval = setInterval(runExportSchedule, SCAN_INTERVAL);
    runExportSchedule();
  }

  if (!importInterval) {
    importInterval = setInterval(runImportSchedule, SCAN_INTERVAL);
    runImportSchedule();
  }

  if (!importTimeoutCheckInterval) {
    importTimeoutCheckInterval = setInterval(runImportTimeoutCheck, 10000);
  }
}

export function stopSerialScheduler(): void {
  if (exportInterval) {
    clearInterval(exportInterval);
    exportInterval = null;
  }
  if (importInterval) {
    clearInterval(importInterval);
    importInterval = null;
  }
  if (importTimeoutCheckInterval) {
    clearInterval(importTimeoutCheckInterval);
    importTimeoutCheckInterval = null;
  }
  for (const [, child] of activeWorkers) {
    killWorker(child);
  }
  activeWorkers.clear();
}

export function triggerExportScheduler(): void {
  runExportSchedule();
}

export function triggerImportScheduler(): void {
  runImportSchedule();
}

export { activeWorkers };
