import { Context } from '@nocobase/actions';
export interface TablePermission {
    canImport: boolean;
    canExport: boolean;
    importMode: string[];
    importFields: string[];
    exportFields: string[];
    exportFilter: Record<string, unknown> | null;
    uniqueFields: string[];
    requiredFields: string[];
}
export declare function checkImportPermission(ctx: Context, tableName: string, permSource?: {
    type: string;
    id?: string;
} | null): Promise<TablePermission>;
export declare function checkExportPermission(ctx: Context, tableName: string): Promise<TablePermission>;
