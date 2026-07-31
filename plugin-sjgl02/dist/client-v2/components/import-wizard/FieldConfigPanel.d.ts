import React from 'react';
import { FieldMetaInfo, ImportFieldConfig } from '../../services/api';
export declare function isRelationField(f?: FieldMetaInfo): boolean;
export declare function defaultFieldConfig(): ImportFieldConfig;
export default function FieldConfigPanel({ field, config, mode, folders, onChange, }: {
    field: FieldMetaInfo;
    config: ImportFieldConfig;
    mode: string;
    folders: Array<{
        name: string;
        fileCount: number;
    }>;
    onChange: (config: ImportFieldConfig) => void;
}): React.JSX.Element;
