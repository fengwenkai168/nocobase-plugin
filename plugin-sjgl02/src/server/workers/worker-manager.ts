import { ChildProcess, fork } from 'child_process';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import type { StartMessage, WorkerMessage } from './types';
import {
  resolveTempDir,
  getFieldDisplayName,
  getCollDisplayName,
  getScalarFieldNames,
  getRelationFieldNames,
  detectPkStrategy,
  getAttachFieldNames,
  getFileIdFieldNames,
} from './worker-utils';

const HEARTBEAT_TIMEOUT = 120000; // 子进程 2 分钟无心跳 → 杀
const SIGTERM_GRACE = 10000; // SIGTERM 后等 10 秒再 SIGKILL
const MAX_TASK_DURATION = 30 * 60 * 1000; // 导入总超时 30 分钟

/** 活跃的导出子进程：taskId → ChildProcess */
export const activeWorkers = new Map<number, ChildProcess>();

/** 获取编译后的 worker 入口路径 */
function getWorkerPath(): string {
  const candidate = path.join(__dirname, 'export-worker.js');
  if (fs.existsSync(candidate)) return candidate;
  // tsx 源码模式：从 src/server/workers/ 推算 dist/server/workers/
  return path.resolve(__dirname, '..', '..', '..', 'dist', 'server', 'workers', 'export-worker.js');
}

/** 杀掉一个子进程（优雅退出 → 强制杀） */
function killWorker(child: ChildProcess): void {
  if (child.exitCode !== null) return;
  try {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }, SIGTERM_GRACE);
  } catch {
    /* 忽略 */
  }
}

async function logStderrToTask(taskId: number, repo: any, prefix: string, stderr: string): Promise<void> {
  if (!stderr) return;
  try {
    const logRepo = repo.db.getRepository('sjgl02_task_logs');
    await logRepo.create({
      values: { taskId, level: 'ERROR', message: `${prefix}\n${stderr.substring(0, 8000)}`, timestamp: new Date() },
    });
  } catch {
    // ignore
  }
}

/** fork 失败时的兜底内联导出 */
async function runExportInline(msg: StartMessage, db: any): Promise<void> {
  const {
    taskId,
    tableName,
    fieldNames,
    fieldHeaders,
    collDisplayName,
    tempDir,
    pkStrategy,
    pkField,
    fileNameTemplate,
    fieldMetas,
  } = msg;
  const targetRepo = db.getRepository(tableName);
  if (!targetRepo) throw new Error(`表 ${tableName} 不存在`);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // 按模板生成文件名
  let fname: string;
  if (fileNameTemplate) {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
      d.getMinutes(),
    )}${pad(d.getSeconds())}`;
    const tbl = db.getCollection(tableName);
    const rawName = tbl?.options?.title || tbl?.name || tableName;
    fname = fileNameTemplate.replace(/\{表名\}/g, rawName).replace(/\{日期\}/g, date) + '.xlsx';
  } else {
    fname = `sjgl02_export_${taskId}_${Date.now()}.xlsx`;
  }
  const filePath = path.join(tempDir, fname);
  const streamWriter = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false,
  });
  const sheet = streamWriter.addWorksheet(collDisplayName.substring(0, 31).replace(/[\\/:*?[\]]/g, '_'));

  const scalarFieldNames =
    fieldMetas && fieldMetas.length > 0
      ? fieldMetas.filter((m) => m.isScalar).map((m) => m.name)
      : fieldNames.filter((f) => !['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f as any));
  sheet.columns = scalarFieldNames.map((f) => ({ header: fieldHeaders[f] || f, key: f, width: 20 }));
  (sheet.getRow(1) as any).font = { bold: true };
  let processedRows = 0;
  const PAGE_SIZE = 2000;
  if (pkStrategy === 'cursor' && pkField) {
    let lastId = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await targetRepo.find({
        filter: { [pkField]: { $gt: lastId } },
        sort: [pkField],
        limit: PAGE_SIZE,
        raw: true,
      });
      if (page.length === 0) {
        hasMore = false;
        continue;
      }
      for (const r of page) {
        const row: any = {};
        for (const f of scalarFieldNames) row[f] = r[f] ?? '';
        sheet.addRow(row).commit();
        processedRows++;
      }
      lastId = Number(page[page.length - 1][pkField]);
    }
  } else {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await targetRepo.find({ filter: {}, offset, limit: PAGE_SIZE, raw: true });
      if (page.length === 0) {
        hasMore = false;
        continue;
      }
      for (const r of page) {
        const row: any = {};
        for (const f of scalarFieldNames) row[f] = r[f] ?? '';
        sheet.addRow(row).commit();
        processedRows++;
      }
      offset += PAGE_SIZE;
    }
  }
  sheet.commit();
  await streamWriter.commit();
  const stats = fs.statSync(filePath);
  const storageDir = process.env.STORAGE_DIR || 'storage/uploads';
  const attachRepo = db.getRepository('attachments');
  const attachment = await attachRepo.create({
    values: {
      title: path.basename(filePath),
      filename: path.basename(filePath),
      extname: '.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: stats.size,
      path: path.relative(storageDir, filePath).replace(/\\/g, '/'),
    },
  });
  const repo = db.getRepository('sjgl02_tasks');
  await repo.update({
    filterByTk: taskId,
    values: {
      status: 'completed',
      progress: 100,
      processedRows,
      exportFileId: attachment.id,
      fileName: attachment.filename || '',
      completedAt: new Date(),
    },
  });
}

/** fork 导出子进程，设置心跳和总超时监控。
 *  当 SJGL02_NO_FORK=1 时，跳过 fork 直接原地执行（测试环境用）。
 */
export function forkExportWorker(taskId: number, startMsg: StartMessage, repo: any, storedDb: any): ChildProcess {
  const workerPath = getWorkerPath();
  if (!fs.existsSync(workerPath)) {
    // dist 未构建时的兜底内联
    setImmediate(async () => {
      try {
        await runExportInline(startMsg, storedDb || (repo as any).db);
      } catch (e: any) {
        await repo
          .update({
            filterByTk: taskId,
            values: { status: 'failed', errorMessage: e?.message || String(e), completedAt: new Date() },
          })
          .catch(() => {});
      }
    });
    return null as unknown as ChildProcess;
  }
  const child = fork(workerPath, [], { silent: true, execArgv: [] });

  // 收集子进程的 stderr（用于诊断 Worker crash 原因，限制 10KB）
  const STDERR_MAX_SIZE = 10240;
  let stderrBuf = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    if (stderrBuf.length < STDERR_MAX_SIZE) {
      stderrBuf += chunk.toString('utf8');
      if (stderrBuf.length > STDERR_MAX_SIZE) {
        stderrBuf = stderrBuf.slice(0, STDERR_MAX_SIZE);
      }
    }
  });

  activeWorkers.set(taskId, child);

  let lastHeartbeat = 0;
  let resolved = false;
  let forkedFailed = false;
  let lastCompletedFilePath: string | null = null;

  // 15 秒无活动（无心跳/未完成）→ 子进程卡死，回退内联
  let forkTimeout: ReturnType<typeof setTimeout> = setTimeout(() => {
    if (!resolved) {
      forkedFailed = true;
      killWorker(child);
    }
  }, 15000);

  function resetForkTimeout(): void {
    clearTimeout(forkTimeout);
    forkTimeout = setTimeout(() => {
      if (!resolved) {
        forkedFailed = true;
        killWorker(child);
      }
    }, 15000);
  }

  const heartbeatTimer = setInterval(() => {
    if (resolved || forkedFailed) return;
    const elapsed = Date.now() - lastHeartbeat;
    if (lastHeartbeat > 0 && elapsed > HEARTBEAT_TIMEOUT) {
      forkedFailed = true;
      killWorker(child);
      setImmediate(async () => {
        try {
          await runExportInline(startMsg, storedDb || (repo as any).db);
        } catch (e: any) {
          await repo
            .update({
              filterByTk: taskId,
              values: { status: 'failed', errorMessage: e?.message || String(e), completedAt: new Date() },
            })
            .catch(() => {});
        }
      });
    }
  }, 30000);

  const maxDurationTimer = setTimeout(() => {
    if (!resolved) {
      killWorker(child);
    }
  }, MAX_TASK_DURATION);

  function cleanup() {
    if (resolved) return;
    resolved = true;
    clearTimeout(forkTimeout);
    clearInterval(heartbeatTimer);
    clearTimeout(maxDurationTimer);
    activeWorkers.delete(taskId);
  }

  child.on('message', async (msg: WorkerMessage) => {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'heartbeat':
        lastHeartbeat = Date.now();
        resetForkTimeout();
        break;
      case 'progress':
        try {
          await repo.update({
            filterByTk: taskId,
            values: { processedRows: msg.processedRows, totalRows: msg.totalRows, progress: msg.progress },
          });
        } catch {
          /* 忽略 */
        }
        break;
      case 'log':
        try {
          const logRepo = repo.db.getRepository('sjgl02_task_logs');
          await logRepo.create({ values: { taskId, level: msg.level, message: msg.message, timestamp: new Date() } });
        } catch {
          /* 忽略 */
        }
        break;
      case 'completed':
        lastCompletedFilePath = msg.filePath;
        try {
          await repo.update({
            filterByTk: taskId,
            values: { fileName: msg.filePath, processedRows: msg.processedRows },
          });
        } catch {
          /* 忽略 */
        }
        break;
      case 'error':
        break; // 在 exit 事件中统一处理
    }
  });

  child.on('exit', (code, signal) => {
    cleanup();

    if (forkedFailed) {
      setImmediate(async () => {
        try {
          await runExportInline(startMsg, storedDb || (repo as any).db);
        } catch (e: any) {
          await repo
            .update({
              filterByTk: taskId,
              values: { status: 'failed', errorMessage: e?.message || String(e), completedAt: new Date() },
            })
            .catch(() => {});
        }
      });
      return;
    }

    const exitOk = code === 0 && !signal;

    (async () => {
      if (exitOk) {
        // 正常退出：子进程已把文件路径写到了 sjgl02_tasks 的 fileName 字段
        // 这里需要创建 attachment 记录并更新 exportFileId
        try {
          const task = await repo.findOne({ filterByTk: taskId, raw: true });
          if (!task) return;
          const fileName = (task as any)?.fileName || lastCompletedFilePath || '';
          if (!fileName) return;

          const { resolveAttachmentFromFile } = await import('../actions/export');
          const exportFileId = await resolveAttachmentFromFile(repo.db, fileName, taskId);
          if (exportFileId) {
            await repo.update({
              filterByTk: taskId,
              values: { exportFileId, status: 'completed', progress: 100, completedAt: new Date() },
            });
            const logRepo = repo.db.getRepository('sjgl02_task_logs');
            await logRepo
              .create({
                values: {
                  taskId,
                  level: 'SUCC',
                  message: `导出完成，共 ${(task as any)?.processedRows || 0} 行数据`,
                  timestamp: new Date(),
                },
              })
              .catch(() => {});
          }
        } catch (err: any) {
          await repo.update({
            filterByTk: taskId,
            values: { status: 'failed', errorMessage: `收尾阶段失败: ${err.message}`, completedAt: new Date() },
          });
        }
      } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        const task = await repo.findOne({ filterByTk: taskId, fields: ['status'] }).catch(() => null);
        if (!task) return;
        const status = (task as any)?.status;
        // 如果是用户取消，保留 cancelled 状态
        if (status !== 'cancelled') {
          await repo.update({
            filterByTk: taskId,
            values: { status: 'timeout', errorMessage: '任务执行超时', completedAt: new Date() },
          });
        }
      } else {
        const errDetail = stderrBuf ? `\nstderr: ${stderrBuf.substring(0, 500)}` : '';
        const errorMessage = `Worker exit code ${code}${errDetail}`;
        await repo.update({
          filterByTk: taskId,
          values: { status: 'failed', errorMessage, completedAt: new Date() },
        });
        logStderrToTask(taskId, repo, `Worker exit code ${code}`, stderrBuf).catch(() => {});
      }
    })();
  });

  child.on('error', async (err) => {
    cleanup();
    try {
      await repo.update({
        filterByTk: taskId,
        values: { status: 'failed', errorMessage: `Worker error: ${err.message}`, completedAt: new Date() },
      });
    } catch {
      // ignore
    }
    try {
      const logRepo = repo.db.getRepository('sjgl02_task_logs');
      await logRepo.create({
        values: { taskId, level: 'ERROR', message: `Worker error: ${err.message}`, timestamp: new Date() },
      });
      await logStderrToTask(taskId, repo, 'Worker stderr', stderrBuf);
    } catch {
      // ignore
    }
  });

  // 发送启动消息
  child.send(startMsg);

  return child;
}

export { killWorker };
