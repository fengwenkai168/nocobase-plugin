import type { Permission, Target, PermissionFormValues } from '../types/permission';
export declare function usePermissions(api: any, target: Target | null): {
    perms: Permission[];
    inheritedPerms: Permission[];
    customPerms: Permission[];
    loading: boolean;
    isSystemManaged: boolean;
    toggle: (tableName: string, field: 'canImport' | 'canExport') => void;
    remove: (tableName: string) => void;
    save: (values: PermissionFormValues, editPerm?: Permission) => Promise<boolean>;
    refresh: () => Promise<void>;
};
