import React from 'react';
import { ImportTableItem } from '../import-hooks/importTypes';
interface ImportStepSelectTableProps {
    loading: boolean;
    tables: ImportTableItem[];
    selectedTable: ImportTableItem | null;
    onSelect: (table: ImportTableItem | null) => void;
    onNext: () => void;
}
export default function ImportStepSelectTable({ loading, tables, selectedTable, onSelect, onNext, }: ImportStepSelectTableProps): React.JSX.Element;
export {};
