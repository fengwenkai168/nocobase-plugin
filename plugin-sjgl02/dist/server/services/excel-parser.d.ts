export interface SheetMeta {
    name: string;
    rowCount: number;
}
export interface SheetPreview {
    headers: string[];
    rows: unknown[][];
    totalRows: number;
}
export type FileKind = 'xlsx' | 'xls' | 'csv';
export declare function yieldEventLoop(): Promise<void>;
export declare const ROW_LIMITS: Record<FileKind, number>;
export declare function detectFileKind(fileName: string): FileKind | null;
export declare function listSheets(filePath: string, kind: FileKind): Promise<SheetMeta[]>;
export declare function readPreview(filePath: string, kind: FileKind, sheetName: string, headerRow: number, limit?: number): Promise<SheetPreview>;
export declare function iterateRows(filePath: string, kind: FileKind, sheetName: string, headerRow: number): AsyncGenerator<{
    rowNumber: number;
    values: unknown[];
}>;
export declare function countDataRows(filePath: string, kind: FileKind, sheetName: string, headerRow: number): Promise<number>;
