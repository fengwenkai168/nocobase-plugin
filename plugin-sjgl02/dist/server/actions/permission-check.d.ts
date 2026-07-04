import { Context } from '@nocobase/actions';
import { type TablePermission, type PermSource } from '../services/permission-service';
export type { TablePermission, PermSource };
export declare function checkImportPermission(ctx: Context, tableName: string, permSource?: PermSource | null): Promise<TablePermission>;
export declare function checkExportPermission(ctx: Context, tableName: string, permSource?: PermSource | null): Promise<TablePermission>;
