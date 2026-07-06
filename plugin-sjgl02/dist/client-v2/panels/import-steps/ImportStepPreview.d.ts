import React from 'react';
import { ImportTableItem } from '../import-hooks/importTypes';
interface ImportStepPreviewProps {
    selectedTable: ImportTableItem | null;
    uploadedFileName: string;
    sheetName: string;
    headerRow: number;
    importMode: string;
    previewData: any;
    tableFields: any[];
    uniqueFields: string[];
    fieldMapping: Record<string, string>;
    customValues: Record<string, string>;
    onPrev: () => void;
    onExecute: () => void;
}
export default function ImportStepPreview({ selectedTable, uploadedFileName, sheetName, headerRow, importMode, previewData, tableFields, uniqueFields, fieldMapping, customValues, onPrev, onExecute, }: ImportStepPreviewProps): React.JSX.Element;
export {};
