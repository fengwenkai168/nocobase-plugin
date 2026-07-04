import type { Database } from '@nocobase/database';
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
export interface PermSource {
    type: string;
    id?: string;
}
export declare class PermissionService {
    private db;
    constructor(db: Database);
    getUserRoleNames(userId: number | string): Promise<string[]>;
    findPermission(targetType: string, targetId: string, tableName: string): Promise<any | null>;
    findPermissionsByTarget(targetType: string, targetId: string): Promise<any[]>;
    findPermissionsByRoles(roleNames: string[]): Promise<any[]>;
    private fullPermission;
    private permissionFromRecord;
    private mergePermissions;
    checkPermission(currentUserId: number, tableName: string, actionType: 'import' | 'export', permSource?: PermSource | null): Promise<TablePermission>;
    getAdminAllPermissions(): Promise<any[]>;
    getRolePermissions(roleName: string): Promise<{
        custom: any[];
        inherited: any[];
    }>;
    getUserPermissions(userId: number | string): Promise<{
        custom: any[];
        inherited: any[];
    }>;
    getExportScopes(currentUserId: number, tableName: string, permSource?: PermSource | null): Promise<{
        type: string;
        id: string;
        label: string;
        canExport: boolean;
        exportFilter: Record<string, unknown> | null;
    }[]>;
    private getAllTableNames;
}
