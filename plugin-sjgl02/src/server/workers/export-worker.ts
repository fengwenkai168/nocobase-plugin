/**
 * 导出子进程入口。
 * 负责：接收启动消息 → 连接 PG → 导出 scalar 主表 → 添加关联表 sheet →
 *       收集附件 → 打包 ZIP → IPC 汇报进度
 */

import fs from 'fs';
import path from 'path';
import type { ParentMessage, WorkerMessage, StartMessage } from './types';
import { resolveTempDir } from './worker-utils';
import { resolveExportBaseName, buildExportZip } from './export-worker-utils';
import { exportScalarTable } from './export-scalar';
import { exportAssociationSheets } from './export-association';
import { collectAttachmentIds } from './export-attachment';

function send(msg: WorkerMessage): void {
  if (process.send) process.send(msg);
}

console.error('[export-worker] process started, pid:', process.pid, ')');

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_DATABASE || 'nocobase',
    username: process.env.DB_USER || 'nocobase',
    password: process.env.DB_PASSWORD || 'nocobase',
  };
}

async function isCancelled(sequelize: any, taskId: number): Promise<boolean> {
  try {
    const [rows] = (await sequelize.query('SELECT "status" FROM "sjgl02_tasks" WHERE "id" = $1', {
      bind: [taskId],
    })) as any[];
    return rows && rows[0]?.status === 'cancelled';
  } catch {
    return false;
  }
}

async function runSingleExport(msg: StartMessage): Promise<void> {
  console.error('[export-worker] runSingleExport started');
  const {
    taskId,
    tableName,
    fieldHeaders,
    collDisplayName,
    pkStrategy,
    pkField,
    collectionTotal,
    includeAssociationSheet,
    associationSheets,
    includeAttachments,
    fieldMetas,
    tempDir,
    fileNameTemplate,
  } = msg;

  try {
    send({ type: 'log', level: 'INFO', message: `导出子进程启动，表: ${tableName}` });
  } catch (e) {
    console.error('[export-worker] send log failed', e);
  }

  const cfg = getDbConfig();
  console.error('[export-worker] db config', cfg);
  const { Sequelize } = require('sequelize');
  console.error('[export-worker] sequelize required');
  const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
    host: cfg.host,
    port: cfg.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: { application_name: 'nocobase.export.worker' },
    pool: { max: 3, min: 1, idle: 10000 },
  });
  console.error('[export-worker] sequelize created');

  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    console.error('[export-worker] temp dir ok', tempDir);

    const baseName = resolveExportBaseName(tableName, fileNameTemplate);
    console.error('[export-worker] baseName', baseName);

    const scalarFields = (fieldMetas || []).filter((m) => m.isScalar).map((m) => m.name);
    console.error('[export-worker] scalarFields', scalarFields);
    const scalarFieldHeaders: Record<string, string> = {};
    for (const f of scalarFields) scalarFieldHeaders[f] = fieldHeaders?.[f] || f;

    console.error('[export-worker] calling exportScalarTable');
    const scalarResult = await exportScalarTable({
      sequelize,
      tableName,
      fieldNames: scalarFields,
      fieldHeaders: scalarFieldHeaders,
      collDisplayName,
      pkStrategy,
      pkField,
      collectionTotal,
      tempDir,
      fileNameTemplate,
      send,
      isCancelled: () => isCancelled(sequelize, taskId),
    });

    if (includeAssociationSheet && associationSheets && associationSheets.length > 0) {
      await exportAssociationSheets({
        sequelize,
        workbook: scalarResult.streamWriter,
        associationSheets,
        send,
        isCancelled: () => isCancelled(sequelize, taskId),
      });
    }

    await scalarResult.streamWriter.commit();

    const attachments = await collectAttachmentIds({
      sequelize,
      tableName,
      fieldMetas: fieldMetas || [],
      mainIds: scalarResult.mainIds,
      includeAttachments: includeAttachments || false,
    });

    const xlsxPath = scalarResult.filePath;
    const zipPath = path.join(tempDir, `${baseName}.zip`);
    await buildExportZip({ xlsxPath, attachments, outputPath: zipPath, baseName });

    try {
      fs.unlinkSync(xlsxPath);
    } catch {
      // ignore
    }

    const stats = fs.statSync(zipPath);
    send({ type: 'log', level: 'SUCC', message: `导出完成，共 ${scalarResult.processedRows} 行数据，附件 ${attachments.length} 个` });
    send({ type: 'completed', filePath: zipPath, fileSize: stats.size, processedRows: scalarResult.processedRows });
    await sequelize.close();
    process.exit(0);
  } catch (err: any) {
    console.error('[export-worker] runSingleExport error', err?.message, err?.stack);
    const message = err?.message || String(err);
    try { send({ type: 'log', level: 'ERROR', message: `导出失败: ${message}` }); } catch {}
    try { send({ type: 'error', message, stack: err?.stack }); } catch {}
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

async function runMultiExport(msg: StartMessage): Promise<void> {
  if (!msg.tableList) return;
  const { taskId, tableList, tempDir } = msg;

  send({ type: 'log', level: 'INFO', message: `多表导出启动，共 ${tableList.length} 张表` });

  const cfg = getDbConfig();
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
    host: cfg.host,
    port: cfg.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: { application_name: 'nocobase.export.multi' },
    pool: { max: 3, min: 1, idle: 10000 },
  });

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const xlsxDir = path.join(tempDir, `export_${taskId}_${Date.now()}`);
  fs.mkdirSync(xlsxDir, { recursive: true });

  let totalProcessed = 0;
  const totalRows = tableList.reduce((s, t) => s + t.collectionTotal, 0);
  const xlsxFiles: string[] = [];

  try {
    for (let i = 0; i < tableList.length; i++) {
      const tableCfg = tableList[i];
      send({
        type: 'log',
        level: 'INFO',
        message: `正在导出 [${i + 1}/${tableList.length}] ${tableCfg.collDisplayName}(${tableCfg.tableName})`,
      });

      const { filePath, processedRows } = await exportScalarTable({
        sequelize,
        tableName: tableCfg.tableName,
        fieldNames: tableCfg.fieldNames,
        fieldHeaders: tableCfg.fieldHeaders,
        collDisplayName: tableCfg.collDisplayName,
        pkStrategy: tableCfg.pkStrategy,
        pkField: tableCfg.pkField,
        collectionTotal: tableCfg.collectionTotal,
        tempDir: xlsxDir,
        send,
        isCancelled: () => isCancelled(sequelize, taskId),
      });
      xlsxFiles.push(filePath);
      totalProcessed += processedRows;

      const pct = Math.min(95, Math.floor((totalProcessed / Math.max(1, totalRows)) * 100));
      send({ type: 'progress', processedRows: totalProcessed, totalRows, progress: pct });
      send({ type: 'heartbeat', ts: Date.now() });
    }

    send({ type: 'log', level: 'INFO', message: `正在打包 ${xlsxFiles.length} 个 Excel 文件为 tar.gz` });
    const archiver = require('archiver');
    const tarName = `全部数据表_${new Date().toISOString().slice(0, 10)}.tar.gz`;
    const tarPath = path.join(tempDir, tarName);
    const output = fs.createWriteStream(tarPath);
    const archive = archiver('tar', { gzip: true, gzipOptions: { level: 6 } });

    await new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      for (const f of xlsxFiles) {
        archive.file(f, { name: path.basename(f) });
      }
      archive.finalize();
    });

    for (const f of xlsxFiles) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
    try {
      fs.rmdirSync(xlsxDir);
    } catch {}

    const stats = fs.statSync(tarPath);
    send({ type: 'log', level: 'SUCC', message: `多表导出完成，共 ${tableList.length} 张表，${totalProcessed} 行数据` });
    send({ type: 'completed', filePath: tarPath, fileSize: stats.size, processedRows: totalProcessed });
    await sequelize.close();
    process.exit(0);
  } catch (err: any) {
    send({ type: 'log', level: 'ERROR', message: `多表导出失败: ${err.message}` });
    send({ type: 'error', message: err.message || String(err), stack: err.stack });
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

process.on('message', (msg: ParentMessage) => {
  console.error('[export-worker] received message', msg?.type);
  if (msg.type === 'start') {
    if (msg.tableName === '__all__' && msg.tableList) {
      runMultiExport(msg);
    } else {
      runSingleExport(msg);
    }
  }
  if (msg.type === 'cancel') {
    send({ type: 'log', level: 'WARN', message: '收到取消信号' });
    process.exit(0);
  }
});

process.on('uncaughtException', (err) => {
  console.error('[export-worker] uncaughtException', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[export-worker] unhandledRejection', err);
  process.exit(1);
});

try {
  send({ type: 'heartbeat', ts: Date.now() });
  console.error('[export-worker] heartbeat sent');
} catch (e) {
  console.error('[export-worker] heartbeat send failed', e);
  process.exit(1);
}
