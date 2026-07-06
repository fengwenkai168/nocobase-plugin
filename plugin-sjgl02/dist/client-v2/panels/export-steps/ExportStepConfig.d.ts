import React from 'react';
import { ExportTableItem, PermSourceOption, ExportFieldItem } from '../export-hooks/exportTypes';
interface ExportStepConfigProps {
    isAdminOrRoot: boolean;
    isAllTables: boolean;
    selTable: string;
    permSource: {
        type: string;
        id?: string;
        label?: string;
    } | null;
    permSourceOptions: PermSourceOption[];
    onPermSourceChange: (val: string) => void;
    tables: ExportTableItem[];
    fields: ExportFieldItem[];
    selFields: string[];
    setSelFields: (v: string[]) => void;
    onToggleField: (name: string) => void;
    includeAssocSheet: boolean;
    onIncludeAssocSheetChange: (v: boolean) => void;
    selectedAssocTables: string[];
    onSelectedAssocTablesChange: (v: string[]) => void;
    fileName: string;
    onFileNameChange: (v: string) => void;
    headerStyle: string;
    onHeaderStyleChange: (v: string) => void;
    includeAttachments: boolean;
    onIncludeAttachmentsChange: (v: boolean) => void;
    onPrev: () => void;
    onNext: () => void;
}
export default function ExportStepConfig({ isAdminOrRoot, isAllTables, selTable, permSource, permSourceOptions, onPermSourceChange, tables, fields, selFields, setSelFields, onToggleField, includeAssocSheet, onIncludeAssocSheetChange, selectedAssocTables, onSelectedAssocTablesChange, fileName, onFileNameChange, headerStyle, onHeaderStyleChange, includeAttachments, onIncludeAttachmentsChange, onPrev, onNext, }: ExportStepConfigProps): React.JSX.Element;
export {};
