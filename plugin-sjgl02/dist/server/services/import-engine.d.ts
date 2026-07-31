import type Plugin from '../plugin';
import type { TaskHandlerContext } from './task-queue';
import type { FileKind } from './excel-parser';
import { BlankStrategy, FieldConfig, FieldMeta, ImportMode } from './value-converter';
export interface ImportMappingItem {
    field: string;
    source: 'excel' | 'custom' | 'ignore';
    columnIndex?: number;
    columnName?: string;
    value?: string;
    config?: FieldConfig;
}
export interface ImportTaskParams {
    filePath: string;
    fileName: string;
    fileKind: FileKind;
    sheetName: string;
    headerRow: number;
    collectionName: string;
    mode: ImportMode;
    uniqueFields: string[];
    blankStrategy: BlankStrategy;
    mapping: ImportMappingItem[];
    requiredFields: string[];
    attachmentArchivePath?: string;
    operatorUserId: number;
    plannedRows?: number;
}
export declare class ImportFailedError extends Error {
    details: Record<string, unknown>;
    constructor(message: string, details: Record<string, unknown>);
}
export declare class ImportEngine {
    private plugin;
    constructor(plugin: Plugin);
    private get db();
    buildFieldMeta(collectionName: string, fieldName: string): FieldMeta | null;
    private getPkInfo;
    run(ctx: TaskHandlerContext, params: ImportTaskParams): Promise<Record<string, unknown>>;
    private prepareRow;
    private processUpsertChunk;
    private mergeAppendRelations;
    private processAttachments;
}
