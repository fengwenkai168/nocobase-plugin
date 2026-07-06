import type { FieldInfo } from '../types/permission';
export declare function useTableFields(api: any): {
    fields: FieldInfo[];
    loading: boolean;
    loadFields: (tableName: string) => Promise<void>;
};
