import type { Database } from '@nocobase/database';
export interface AttachmentIndex {
    dir: string;
    files: Map<string, Set<string>>;
}
export declare function extractAttachmentArchive(archivePath: string, destDir: string): Promise<AttachmentIndex>;
export declare function listArchiveFolders(archivePath: string): Promise<Array<{
    name: string;
    fileCount: number;
}>>;
export declare function attachmentExists(index: AttachmentIndex, folderName: string, fileName: string): boolean;
export declare function isAllowedAttachment(fileName: string): boolean;
export declare function getStorageInfo(db: Database): Promise<{
    storagePath: string;
    documentRoot: string;
    storageId: unknown;
}>;
export declare function createAttachmentRecord(db: Database, filePath: string, fileName: string, storageInfo?: {
    storagePath: string;
    documentRoot: string;
    storageId: unknown;
}): Promise<Record<string, unknown>>;
