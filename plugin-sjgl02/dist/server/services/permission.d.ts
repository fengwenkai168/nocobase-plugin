import type Plugin from '../plugin';
export interface PermConfig {
    id: number | null;
    targetType: 'user' | 'role';
    targetId: string;
    targetName: string;
    canImport: boolean;
    canExport: boolean;
    importModes: string[];
    uniqueFields: string[];
    requiredFields: string[];
    importFields: string[];
    exportFields: string[];
    exportFilter: unknown;
}
export declare const ADMIN_ROLES: string[];
export declare class PermissionService {
    private plugin;
    constructor(plugin: Plugin);
    private get repo();
    getUserRoleNames(userId: number): Promise<string[]>;
    isAdmin(roleNames: string[]): boolean;
    private toConfig;
    private adminConfig;
    listImportPermissions(userId: number, collectionName?: string): Promise<PermConfig[]>;
    listExportPermissions(userId: number, collectionName?: string): Promise<PermConfig[]>;
    listExportSchemes(collectionName: string): Promise<Array<{
        id: number;
        targetType: string;
        targetId: string;
        targetName: string;
        exportFields: string[];
    }>>;
    private listConfiguredPermissions;
    private listAllPermissions;
    getPermissionForExecution(userId: number, permissionId: number | null | undefined): Promise<{
        config: PermConfig;
        roleNames: string[];
    }>;
    assertImportParams(config: PermConfig, params: {
        mode: string;
        mappingFields: string[];
        uniqueFields: string[];
    }): void;
}
