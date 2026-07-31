import type { FieldMetaInfo } from '../../services/api';
export declare const DATE_TYPES: string[];
export declare const RELATION_TYPES: string[];
export declare function dateFormatOptions(t: (s: string) => string): {
    value: string;
    label: string;
}[];
export declare function relationFormatOptions(t: (s: string) => string): {
    value: string;
    label: string;
}[];
export declare function groupExportFields(fields: FieldMetaInfo[], order: string[]): {
    regular: FieldMetaInfo[];
    dates: FieldMetaInfo[];
    relations: FieldMetaInfo[];
    attachments: FieldMetaInfo[];
};
export type ExportFieldGroups = ReturnType<typeof groupExportFields>;
