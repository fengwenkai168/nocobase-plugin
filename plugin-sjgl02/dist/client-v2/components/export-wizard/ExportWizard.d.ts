import React from 'react';
import { CollectionMeta, CollectionOption, PermConfigInfo } from '../../services/api';
export declare const ALL_TABLES = "__all__";
export interface FilterCondition {
    field: string;
    op: '$eq' | '$gt' | '$gte' | '$lt' | '$lte' | '$includes';
    value: string;
}
export interface ExportWizardState {
    collection?: CollectionOption;
    allTables: boolean;
    isAdmin: boolean;
    meta?: CollectionMeta;
    permissions: PermConfigInfo[];
    permission?: PermConfigInfo;
    selectedFields: string[];
    dateFormats: Record<string, string>;
    relationFormats: Record<string, string>;
    relationExportEnabled: boolean;
    relationFields: string[];
    relationExportMode: 'sheet' | 'file';
    headerType: 'titleName' | 'title' | 'name';
    dataRange: 'all' | 'filtered';
    filters: FilterCondition[];
    exportAttachment: boolean;
    globalDateFormat: string;
    globalRelationFormat: string;
    dirty: boolean;
}
export declare const initialExportState: ExportWizardState;
export default function ExportWizard({ registerDirtyCheck, }: {
    registerDirtyCheck?: (tabKey: string, fn: () => boolean) => () => void;
}): React.JSX.Element;
