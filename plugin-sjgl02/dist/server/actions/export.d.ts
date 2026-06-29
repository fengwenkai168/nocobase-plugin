import { Context, Next } from '@nocobase/actions';
export declare function getExportTableFields(ctx: Context, next: Next): Promise<void>;
export declare function previewCount(ctx: Context, next: Next): Promise<void>;
export declare function executeExport(ctx: Context, next: Next): Promise<void>;
export declare function getProgress(ctx: Context, next: Next): Promise<void>;
export declare function downloadExport(ctx: Context, next: Next): Promise<void>;
