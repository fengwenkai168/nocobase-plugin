export interface ExportTableItem {
    name: string;
    title: string;
}
export interface PermSourceOption {
    value: string;
    label: string;
    type: string;
    id?: string;
}
export interface ExportFieldItem {
    name: string;
    type?: string;
    isForeignKey?: boolean;
    uiSchema?: {
        title?: string;
    };
    displayName?: string;
}
export declare function optionsEqual(a: PermSourceOption[], b: PermSourceOption[]): boolean;
