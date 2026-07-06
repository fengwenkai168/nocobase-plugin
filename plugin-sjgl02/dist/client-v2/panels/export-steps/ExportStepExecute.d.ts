import React from 'react';
interface ExportStepExecuteProps {
    isAllTables: boolean;
    selFieldsCount: number;
    estimatedRows: number | null;
    fileName: string;
    includeAttachments: boolean;
    onPrev: () => void;
    onExport: () => void;
}
export default function ExportStepExecute({ isAllTables, selFieldsCount, estimatedRows, fileName, includeAttachments, onPrev, onExport, }: ExportStepExecuteProps): React.JSX.Element;
export {};
