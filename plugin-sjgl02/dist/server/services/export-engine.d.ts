import type Plugin from '../plugin';
import type { TaskHandlerContext } from './task-queue';
import { RelationFormat } from './export-format';
export interface ExportFieldConfig {
    field: string;
    dateFormat?: string;
    relationFormat?: RelationFormat;
}
export interface ExportTaskParams {
    collectionName: string;
    allTables?: boolean;
    fields: ExportFieldConfig[];
    headerType: 'titleName' | 'title' | 'name';
    filter?: Record<string, unknown> | null;
    exportFilter?: Record<string, unknown> | null;
    relationFields?: string[];
    relationExportMode?: 'sheet' | 'file';
    exportAttachment?: boolean;
    globalDateFormat?: string;
    globalRelationFormat?: RelationFormat;
    operatorUserId: number;
}
export declare class ExportEngine {
    private plugin;
    constructor(plugin: Plugin);
    private get db();
    private getPkName;
    private buildColumns;
    private formatScalar;
    private resolveRelations;
    private formatRelationCell;
    private writeTableWorkbook;
    private emptyCollected;
    private writeRelationSheets;
    private writeRelationFiles;
    private mergeFilter;
    private collectAttachmentFiles;
    run(ctx: TaskHandlerContext, params: ExportTaskParams): Promise<Record<string, unknown>>;
    private runAllTables;
}
