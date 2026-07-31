import React from 'react';
import { CollectionMeta, FieldMetaInfo, ImportMappingItem, PermConfigInfo } from '../../services/api';
export interface MappingRow extends ImportMappingItem {
    meta: FieldMetaInfo;
}
export declare function useImportableFields(meta?: CollectionMeta, permission?: PermConfigInfo): FieldMetaInfo[];
export declare function buildInitMapping(fields: FieldMetaInfo[]): ImportMappingItem[];
export default function MappingTable({ meta, fields, headers, mapping, requiredFields, uniqueFields, mode, attachmentUploaded, attachmentFolders, onChange, }: {
    meta?: CollectionMeta;
    fields: FieldMetaInfo[];
    headers: string[];
    mapping: ImportMappingItem[];
    requiredFields: string[];
    uniqueFields: string[];
    mode: string;
    attachmentUploaded: boolean;
    attachmentFolders: Array<{
        name: string;
        fileCount: number;
    }>;
    onChange: (mapping: ImportMappingItem[]) => void;
}): React.JSX.Element;
