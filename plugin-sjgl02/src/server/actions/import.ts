import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { koaMulter as multer, storagePathJoin } from '@nocobase/utils';
import { currentUserId } from './utils';
import * as tar from 'tar-stream';
import type Plugin from '../plugin';
import { PermissionService } from '../services/permission';
import { ImportEngine, ImportTaskParams } from '../services/import-engine';
import { ROW_LIMITS, detectFileKind, listSheets, readPreview } from '../services/excel-parser';
import { buildFieldMeta, cleanTitle } from '../services/field-meta';
import { listArchiveFolders } from '../services/attachment';

function sjgl02Dir(...parts: string[]): string {
  return storagePathJoin(path.join('sjgl02', ...parts));
}

function assertSjgl02Path(filePath: string): void {
  const base = path.resolve(sjgl02Dir());
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('非法文件路径');
  }
}

async function saveUpload(ctx: unknown) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  }).single('file');
  await upload(ctx as never, () => {});
  const file = (ctx as Record<string, unknown>)['file'] as
    | { originalname: string; buffer: Buffer; size: number }
    | undefined;
  if (!file) {
    throw new Error('未接收到文件（字段名应为 file）');
  }
  const body = (ctx as { request?: { body?: Record<string, unknown> } }).request?.body || {};
  const kind = (body.kind || 'excel') as 'excel' | 'attachment';
  const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const subDir = kind === 'excel' ? 'imports' : 'attachment-archives';
  const dir = sjgl02Dir(subDir);
  await fsp.mkdir(dir, { recursive: true });
  const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${path.basename(originalName)}`;
  const filePath = path.join(dir, storedName);
  await fsp.writeFile(filePath, file.buffer);
  return { filePath, originalName, size: file.size, kind };
}

async function quickRowCount(
  filePath: string,
  fileKind: 'xlsx' | 'xls' | 'csv',
  sheetName: string,
  headerRow: number,
): Promise<number> {
  if (fileKind === 'xlsx') {
    const sheets = await listSheets(filePath, fileKind);
    const sheet = sheets.find((s) => s.name === sheetName);
    return Math.max((sheet?.rowCount ?? 0) - headerRow, 0);
  }
  const preview = await readPreview(filePath, fileKind, sheetName, headerRow, 1);
  return preview.totalRows;
}

async function buildTemplateArchive(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();
    const chunks: Buffer[] = [];
    pack.on('data', (chunk: Buffer) => chunks.push(chunk));
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    pack.on('error', reject);
    const readme = [
      '附件压缩包使用说明：',
      '1. 将附件文件按文件夹分类整理（如 photos/、docs/），压缩为 tar.gz 格式',
      '2. 上传后，在字段映射的「配置」列为每个附件字段手动选择对应文件夹（必选）',
      '3. Excel 附件列填写文件名（含扩展名），多个附件用逗号分隔',
      '4. 系统从该字段选中的文件夹中查找同名文件，压缩包内文件名必须与 Excel 中填写的完全一致',
    ].join('\n');
    pack.entry({ name: '说明.txt' }, readme, (err) => {
      if (err) return reject(err);
      pack.entry({ name: 'photos/' }, (err2) => {
        if (err2) return reject(err2);
        pack.finalize();
      });
    });
  });
}

export function registerImportActions(plugin: Plugin) {
  const permissionService = new PermissionService(plugin);
  const engine = new ImportEngine(plugin);

  plugin.taskQueue.registerHandler('import', async (ctx, params) => {
    return engine.run(ctx, params as unknown as ImportTaskParams);
  });

  return {
    importUpload: async (ctx, next) => {
      const saved = await saveUpload(ctx);
      const kind = saved.kind;
      if (kind === 'attachment') {
        const folders = await listArchiveFolders(saved.filePath).catch(() => []);
        ctx.body = { filePath: saved.filePath, fileName: saved.originalName, size: saved.size, folders };
        return next();
      }
      const fileKind = detectFileKind(saved.originalName);
      if (!fileKind) {
        await fsp.unlink(saved.filePath).catch(() => {});
        ctx.throw(400, '仅支持 .xlsx / .xls / .csv 格式文件');
      }
      const sheets = await listSheets(saved.filePath, fileKind);
      ctx.body = {
        filePath: saved.filePath,
        fileName: saved.originalName,
        size: saved.size,
        fileKind,
        sheets,
        rowLimit: ROW_LIMITS[fileKind],
      };
      await next();
    },

    previewExcel: async (ctx, next) => {
      const __p = { ...(ctx.action.params || {}), ...(ctx.action.params.values || {}) };
      const { filePath, fileKind, sheetName, headerRow = 1 } = __p;
      if (!filePath || !fileKind || !sheetName) {
        ctx.throw(400, '缺少参数 filePath/fileKind/sheetName');
      }
      assertSjgl02Path(filePath);
      const preview = await readPreview(filePath, fileKind, sheetName, Number(headerRow), 10);
      ctx.body = { headers: preview.headers, previewRows: preview.rows, totalRows: preview.totalRows };
      await next();
    },

    getImportPermissions: async (ctx, next) => {
      const userId = currentUserId(ctx);
      const __p = { ...(ctx.action.params || {}), ...(ctx.action.params.values || {}) };
      const { collectionName } = __p;
      const permissions = await permissionService.listImportPermissions(userId, collectionName || undefined);
      ctx.body = { permissions };
      await next();
    },

    importableCollections: async (ctx, next) => {
      const userId = currentUserId(ctx);
      const roleNames = await permissionService.getUserRoleNames(userId);
      const isAdmin = permissionService.isAdmin(roleNames);
      let names: Set<string>;
      if (isAdmin) {
        names = new Set([...plugin.db.collections.values()].map((c) => c.name));
      } else {
        names = new Set<string>();
        const models = await plugin.db.getRepository('sjgl02Permissions').find({
          filter: {
            canImport: true,
            $or: [
              { targetType: 'user', targetId: String(userId) },
              ...(roleNames.length ? [{ targetType: 'role', targetId: { $in: roleNames } }] : []),
            ],
          },
        });
        for (const m of models) names.add(m.get('collectionName') as string);
      }
      const collections = [...plugin.db.collections.values()]
        .filter((c) => names.has(c.name))
        .map((c) => ({ name: c.name, title: cleanTitle(c.options.title, c.name) }));
      ctx.body = { collections };
      await next();
    },

    import: async (ctx, next) => {
      const values = (ctx.action.params.values || {}) as Record<string, unknown>;
      const required = ['filePath', 'fileName', 'fileKind', 'sheetName', 'collectionName', 'mode', 'mapping'];
      for (const key of required) {
        if (values[key] === undefined || values[key] === null || values[key] === '') {
          ctx.throw(400, `缺少参数 ${key}`);
        }
      }
      assertSjgl02Path(String(values.filePath));
      if (!fs.existsSync(String(values.filePath))) {
        ctx.throw(400, '上传文件不存在或已过期，请重新上传');
      }
      if (values.attachmentArchivePath) {
        assertSjgl02Path(String(values.attachmentArchivePath));
        if (!fs.existsSync(String(values.attachmentArchivePath))) {
          ctx.throw(400, '附件压缩包不存在或已过期，请重新上传');
        }
      }
      const fileKind = String(values.fileKind) as 'xlsx' | 'xls' | 'csv';
      const headerRow = Number(values.headerRow || 1);
      const rowCount = await quickRowCount(String(values.filePath), fileKind, String(values.sheetName), headerRow);
      const limit = ROW_LIMITS[fileKind];
      if (rowCount > limit) {
        ctx.throw(400, `文件行数 ${rowCount} 超过 ${fileKind} 格式上限 ${limit} 行`);
      }

      const userId = currentUserId(ctx);
      const mapping = (values.mapping || []) as Array<{ field: string; source: string }>;
      const mappingFields = mapping.filter((m) => m.source !== 'ignore').map((m) => m.field);
      const { config } = await permissionService.getPermissionForExecution(
        userId,
        values.permissionConfigId === undefined || values.permissionConfigId === null
          ? null
          : Number(values.permissionConfigId),
      );
      permissionService.assertImportParams(config, {
        mode: String(values.mode),
        mappingFields,
        uniqueFields: (values.uniqueFields as string[]) || [],
      });

      // 附件字段校验：已映射的附件字段必须选择压缩包内文件夹
      if (values.attachmentArchivePath) {
        for (const m of mapping) {
          if (m.source === 'ignore') continue;
          const meta = buildFieldMeta(plugin.db, String(values.collectionName), m.field);
          if (meta?.attachment && !(m as { config?: { folder?: string } }).config?.folder) {
            ctx.throw(400, `附件字段 ${meta.title}(${m.field}) 未选择压缩包内文件夹`);
          }
        }
      }

      const collection = plugin.db.getCollection(String(values.collectionName));
      // 数据 createdBy/updatedBy 恒为实际操作人（权限用户仅控制字段/模式权限，不影响数据归属）
      const operatorUserId = userId;
      const taskParams: ImportTaskParams = {
        filePath: String(values.filePath),
        fileName: String(values.fileName),
        fileKind,
        sheetName: String(values.sheetName),
        headerRow,
        collectionName: String(values.collectionName),
        mode: values.mode as ImportTaskParams['mode'],
        uniqueFields: (values.uniqueFields as string[]) || [],
        blankStrategy: (values.blankStrategy as ImportTaskParams['blankStrategy']) || 'clear',
        mapping: mapping as ImportTaskParams['mapping'],
        requiredFields: config.requiredFields,
        attachmentArchivePath: values.attachmentArchivePath ? String(values.attachmentArchivePath) : undefined,
        operatorUserId,
        plannedRows: rowCount,
      };
      const task = await plugin.taskQueue.submit('import', taskParams as unknown as Record<string, unknown>, userId, {
        title: `${collection?.options.title || values.collectionName} 导入`,
        collectionName: String(values.collectionName),
        collectionTitle: String(collection?.options.title || values.collectionName),
        fileName: String(values.fileName),
        filePath: String(values.filePath),
        permissionConfigId: config.id ?? undefined,
        permissionType: config.targetType,
        permissionLabel: config.targetName ? `${config.targetType === 'user' ? '👤' : '🔐'} ${config.targetName}` : undefined,
      });
      ctx.body = { taskId: task.get('id'), rowCount };
      await next();
    },

    downloadTemplate: async (ctx, next) => {
      const buffer = await buildTemplateArchive();
      const zlib = await import('node:zlib');
      ctx.set('Content-Type', 'application/gzip');
      ctx.set('Content-Disposition', 'attachment; filename="attachments-template.tar.gz"');
      ctx.body = zlib.gzipSync(buffer);
      await next();
    },
  };
}
