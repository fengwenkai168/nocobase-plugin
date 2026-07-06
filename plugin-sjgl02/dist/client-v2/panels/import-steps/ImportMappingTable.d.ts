import React from 'react';
interface ImportMappingTableProps {
    tableFields: any[];
    excelHeaders: string[];
    permImportFields: string[];
    permRequiredFields: string[];
    permUniqueFields: string[];
    uniqueFields: string[];
    fieldMapping: Record<string, string>;
    customValues: Record<string, string>;
    onFieldMappingChange: (mapping: Record<string, string>) => void;
    onCustomValuesChange: (values: Record<string, string>) => void;
}
export default function ImportMappingTable({ tableFields, excelHeaders, permImportFields, permRequiredFields, permUniqueFields, uniqueFields, fieldMapping, customValues, onFieldMappingChange, onCustomValuesChange, }: ImportMappingTableProps): React.JSX.Element;
export {};
