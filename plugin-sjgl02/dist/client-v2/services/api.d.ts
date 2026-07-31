export interface TaskRecord {
    id: number;
    type: 'import' | 'export' | string;
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
    title?: string;
    collectionName?: string;
    collectionTitle?: string;
    params?: Record<string, unknown>;
    result?: Record<string, unknown>;
    progressTotal?: number;
    progressCurrent?: number;
    totalRows?: number;
    successRows?: number;
    errorRows?: number;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    message?: string;
    startedAt?: string;
    doneAt?: string;
    duration?: number;
    createdAt?: string;
    createdById?: number;
    createdBy?: {
        id: number;
        nickname?: string;
        username?: string;
    };
    permissionConfigId?: number;
    permissionType?: string;
    permissionLabel?: string;
}
export interface TaskStats {
    total: number;
    succeeded: number;
    running: number;
    pending: number;
    failed: number;
    canceled: number;
}
export interface CollectionOption {
    name: string;
    title: string;
}
export interface FieldMetaInfo {
    name: string;
    title: string;
    type: string;
    interface?: string;
    options?: Array<{
        label: string;
        value: string;
    }>;
    target?: string;
    multiple?: boolean;
    attachment?: boolean;
    ignored?: boolean;
}
export interface CollectionMeta {
    collectionName: string;
    collectionTitle: string;
    pk: {
        name: string;
        type: string;
        auto: boolean;
    };
    fields: FieldMetaInfo[];
}
export interface PermConfigInfo {
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
export interface UploadResult {
    filePath: string;
    fileName: string;
    size: number;
    fileKind?: 'xlsx' | 'xls' | 'csv';
    sheets?: Array<{
        name: string;
        rowCount?: number;
    }>;
    rowLimit?: number;
    folders?: Array<{
        name: string;
        fileCount: number;
    }>;
}
export interface PreviewResult {
    headers: string[];
    previewRows: unknown[][];
    totalRows: number;
}
export interface ImportFieldConfig {
    folder?: string;
    emptyStrategy?: 'skip' | 'clear';
    notFound?: 'fail' | 'skip';
    updateMode?: 'overwrite' | 'append';
}
export interface ImportMappingItem {
    field: string;
    source: 'excel' | 'custom' | 'ignore';
    columnIndex?: number;
    columnName?: string;
    value?: string;
    config?: ImportFieldConfig;
    matchRate?: 100 | 80;
}
export declare function useApi(): {
    post: <T = unknown>(url: string, data?: unknown) => Promise<T>;
    get: <T_1 = unknown>(url: string, params?: Record<string, unknown>) => Promise<T_1>;
    listTasks(params: {
        page?: number;
        pageSize?: number;
        type?: string;
        status?: string;
        keyword?: string;
        dateRange?: [string, string] | null;
    }): Promise<{
        data: TaskRecord[];
        meta: any;
    }>;
    getTask(id: number): Promise<TaskRecord>;
    getStats(): Promise<TaskStats>;
    cancelTask(id: number): Promise<import("axios").AxiosResponse<any, any>>;
    retryTask(id: number): Promise<{
        taskId: number;
    }>;
    getToken(): string;
    downloadUrl(id: number, type?: 'result' | 'source'): string;
    errorReportUrl(id: number): string;
    openDownload(url: string): void;
    downloadFile(url: string, fallbackName?: string): Promise<void>;
    getImportableCollections(): Promise<{
        collections: CollectionOption[];
    }>;
    getExportableCollections(): Promise<{
        collections: CollectionOption[];
        isAdmin: boolean;
    }>;
    getCollectionMeta(collectionName: string): Promise<CollectionMeta>;
    getImportPermissions(collectionName?: string): Promise<{
        permissions: PermConfigInfo[];
    }>;
    getExportPermissions(collectionName?: string): Promise<{
        permissions: PermConfigInfo[];
    }>;
    listExportSchemes(collectionName: string): Promise<{
        schemes: Array<{
            id: number;
            targetType: 'user' | 'role';
            targetId: string;
            targetName: string;
            exportFields: string[];
        }>;
    }>;
    uploadFile(file: File, kind: 'excel' | 'attachment'): Promise<UploadResult>;
    previewExcel(params: {
        filePath: string;
        fileKind: string;
        sheetName: string;
        headerRow: number;
    }): Promise<PreviewResult>;
    submitImport(params: Record<string, unknown>): Promise<{
        taskId: number;
        rowCount: number;
    }>;
    submitExport(params: Record<string, unknown>): Promise<{
        taskId: number;
    }>;
    getPermTargets(): Promise<{
        users: Array<{
            id: number;
            name: string;
            roles: Array<{
                name: string;
                title?: string;
            }>;
        }>;
        roles: Array<{
            name: string;
            title: string;
        }>;
    }>;
    getPermList(targetType: 'user' | 'role', targetId: string): Promise<{
        own: PermRecord[];
        inherited: Array<{
            roleName: string;
            roleTitle: string;
            items: PermRecord[];
            isAdmin: boolean;
        }>;
    }>;
    permListByCollection(collectionName: string): Promise<{
        list: {
            id: number;
            targetType: 'user' | 'role';
            targetId: string;
            targetName: string;
            collectionName: string;
            canImport: boolean;
            canExport: boolean;
            importFields: string[];
            exportFields: string[];
        }[];
    }>;
    createPermission(values: Record<string, unknown>): Promise<unknown>;
    updatePermission(id: number, values: Record<string, unknown>): Promise<unknown>;
    destroyPermission(id: number): Promise<unknown>;
    getPermLogs(params: {
        targetType?: string;
        targetId?: string;
        action?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        data: PermLogRecord[];
        meta: any;
    }>;
    getScope(userId?: number): Promise<{
        userId: number;
        scope: 'self' | 'all';
    }>;
    setScope(userId: number, scope: 'self' | 'all'): Promise<unknown>;
};
export interface PermRecord {
    id: number;
    targetType: 'user' | 'role';
    targetId: string;
    targetName?: string;
    collectionName: string;
    collectionTitle?: string;
    canImport: boolean;
    canExport: boolean;
    importModes?: string[];
    uniqueFields?: string[];
    requiredFields?: string[];
    importFields?: string[];
    exportFields?: string[];
    exportFilter?: unknown;
    sort?: number;
}
export interface PermLogRecord {
    id: number;
    action: 'create' | 'update' | 'delete' | 'toggle';
    targetType: string;
    targetId: string;
    targetName?: string;
    collectionName: string;
    collectionTitle?: string;
    permissionId?: number;
    beforeValue?: Record<string, unknown> | null;
    afterValue?: Record<string, unknown> | null;
    summary?: string;
    createdAt?: string;
    createdById?: number;
    createdBy?: {
        id: number;
        nickname?: string;
        username?: string;
    };
}
