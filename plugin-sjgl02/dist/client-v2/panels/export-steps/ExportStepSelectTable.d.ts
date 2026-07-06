import React from 'react';
import { ExportTableItem } from '../export-hooks/exportTypes';
interface ExportStepSelectTableProps {
    loading: boolean;
    tables: ExportTableItem[];
    isAdminOrRoot: boolean;
    selTable: string;
    onSelect: (val: string) => void;
    onNext: () => void;
}
export default function ExportStepSelectTable({ loading, tables, isAdminOrRoot, selTable, onSelect, onNext, }: ExportStepSelectTableProps): React.JSX.Element;
export {};
