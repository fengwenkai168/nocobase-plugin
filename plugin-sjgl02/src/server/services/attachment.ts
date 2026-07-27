import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import * as tar from 'tar-stream';
import { storagePathJoin } from '@nocobase/utils';
import type { Database } from '@nocobase/database';

export interface AttachmentIndex {
  dir: string;
  files: Map<string, Set<string>>;
}

function normalizeEntryName(name: string): string {
  return name.replace(/^\.\//, '').replace(/^attachments\/?/, '');
}

export async function extractAttachmentArchive(archivePath: string, destDir: string): Promise<AttachmentIndex> {
  await fsp.rm(destDir, { recursive: true, force: true });
  await fsp.mkdir(destDir, { recursive: true });
  const files = new Map<string, Set<string>>();
  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      const normalized = normalizeEntryName(header.name);
      const parts = normalized.split('/').filter(Boolean);
      if (header.type !== 'file' || parts.length < 2) {
        stream.resume();
        stream.on('end', next);
        return;
      }
      const folderName = parts[0];
      const fileName = path.basename(normalized);
      const targetDir = path.join(destDir, folderName);
      fs.mkdirSync(targetDir, { recursive: true });
      const target = path.join(targetDir, fileName);
      const write = fs.createWriteStream(target);
      stream.pipe(write);
      write.on('finish', () => {
        if (!files.has(folderName)) files.set(folderName, new Set());
        files.get(folderName)!.add(fileName);
        next();
      });
      write.on('error', reject);
      stream.on('error', reject);
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    fs.createReadStream(archivePath).pipe(zlib.createGunzip()).pipe(extract);
  });
  return { dir: destDir, files };
}

export async function listArchiveFolders(archivePath: string): Promise<Array<{ name: string; fileCount: number }>> {
  const folders = new Map<string, number>();
  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      const normalized = normalizeEntryName(header.name);
      const parts = normalized.split('/').filter(Boolean);
      if (header.type === 'file' && parts.length >= 2) {
        folders.set(parts[0], (folders.get(parts[0]) || 0) + 1);
      }
      stream.resume();
      stream.on('end', next);
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    fs.createReadStream(archivePath).pipe(zlib.createGunzip()).pipe(extract);
  });
  return [...folders.entries()].map(([name, fileCount]) => ({ name, fileCount }));
}

export function attachmentExists(index: AttachmentIndex, folderName: string, fileName: string): boolean {
  return index.files.get(folderName)?.has(fileName) ?? false;
}

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

const BLOCKED_EXTS = ['.exe', '.bat', '.sh', '.com', '.msi', '.dll'];

export function isAllowedAttachment(fileName: string): boolean {
  return !BLOCKED_EXTS.includes(path.extname(fileName).toLowerCase());
}

export async function createAttachmentRecord(
  db: Database,
  filePath: string,
  fileName: string,
): Promise<Record<string, unknown>> {
  const storagesRepo = db.getRepository('storages');
  let storage = await storagesRepo.findOne({ filter: { default: true } });
  if (!storage) {
    storage = await storagesRepo.findOne({ sort: ['id'] });
  }
  if (!storage) {
    throw new Error('未找到可用的文件存储（storages）');
  }
  const storageJson = storage.toJSON() as Record<string, unknown>;
  if (storageJson.type !== 'local') {
    throw new Error(`附件导入暂仅支持 local 类型存储，当前默认存储为 ${storageJson.type}`);
  }
  const storagePath = String(storageJson.path || '').replace(/^\/|\/$/g, '');
  const documentRoot = (storageJson.options as Record<string, unknown>)?.documentRoot
    ? path.resolve(String((storageJson.options as Record<string, unknown>).documentRoot))
    : storagePathJoin('uploads');
  const targetDir = path.join(documentRoot, storagePath);
  await fsp.mkdir(targetDir, { recursive: true });
  const stat = await fsp.stat(filePath);
  const extname = path.extname(fileName);
  const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname}`;
  await fsp.copyFile(filePath, path.join(targetDir, storedName));
  const record = await db.getRepository('attachments').create({
    context: { state: { currentUser: {} } } as never,
    values: {
      title: fileName.replace(extname, ''),
      filename: storedName,
      extname,
      path: storagePath,
      size: stat.size,
      mimetype: MIME_MAP[extname.toLowerCase()] || 'application/octet-stream',
      storageId: storageJson.id,
    },
  });
  return record.toJSON() as Record<string, unknown>;
}
