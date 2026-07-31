import React from 'react';
import { FieldMetaInfo } from '../../services/api';
interface ExportScheme {
    id: number;
    targetType: 'user' | 'role';
    targetId: string;
    targetName: string;
    exportFields: string[];
}
export default function ExportSchemeModal({ open, collectionName, fields, selectedFields, onClose, onApply, }: {
    open: boolean;
    collectionName: string;
    fields: FieldMetaInfo[];
    selectedFields: string[];
    onClose: () => void;
    onApply: (scheme: ExportScheme) => void;
}): React.JSX.Element;
export {};
