import React from 'react';
import { TaskRecord } from '../../services/api';
interface MappingItem {
    field: string;
    source: string;
    columnName?: string;
    value?: string;
}
export default function TaskPreviewTable({ task, previewRows, headers, mapping, fieldLabel, }: {
    task: TaskRecord;
    previewRows: unknown[][];
    headers: string[];
    mapping: MappingItem[];
    fieldLabel: (name: string) => string;
}): React.JSX.Element;
export {};
