export type RelationFormat = 'display' | 'pk' | 'displayPk';
export declare const DATE_FORMATS: readonly ["YYYY-MM-DD HH:mm:ss", "YYYY/MM/DD HH:mm:ss", "YYYY-MM-DD", "YYYY/MM/DD", "DD/MM/YYYY", "UTC ISO 8601", "时间戳(毫秒)", "时间戳(秒)"];
export declare function formatDateValue(value: unknown, format: string): string | number | null;
export declare function formatBooleanValue(value: unknown): string | null;
export declare function formatSelectValue(value: unknown, options?: Array<{
    label: string;
    value: string;
}>): string | null;
export declare function formatMultiSelectValue(value: unknown, options?: Array<{
    label: string;
    value: string;
}>): string | null;
export declare function formatRelationRecord(record: Record<string, unknown> | null | undefined, pkName: string, titleField: string, format: RelationFormat): string | null;
export declare function getTitleField(collection: {
    options: Record<string, unknown>;
    getField: (name: string) => unknown;
}, pkName: string): string;
